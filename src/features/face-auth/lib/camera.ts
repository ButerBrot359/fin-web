import type { CaptureCapabilities, CaptureParams } from '../types/face-auth'

/**
 * Доступ к камере для входа по лицу (ADR-0069 §D11).
 *
 * Здесь сознательно нет ни одной попытки «улучшить» картинку. Сервер измеряет, как кожа
 * откликается на заданную им подсветку, — любая наша постобработка меняет ровно то, что он
 * измеряет, и превращает живого человека в отказ.
 */

export class CameraAccessError extends Error {
  constructor(
    message: string,
    /** Имя DOMException — по нему UI отличает «запретил» от «камеры нет». */
    readonly reason: string
  ) {
    super(message)
    this.name = 'CameraAccessError'
  }
}

/**
 * Запрашивает поток с камеры.
 *
 * Размер запрашивается ровно тот, что назначил сервер: он же зашит в `IMG_LENGTH_LIMIT`
 * распознавателя, и кадр другого размера будет уменьшен уже на сервере — с потерей той самой
 * мелкой фактуры, по которой отличают кожу от экрана.
 *
 * Экспозиция и баланс белого НЕ выставляются (§D11): в Firefox и Safari таких ограничений нет
 * вовсе, в Chrome они поддержаны не всеми камерами, а применённая настройка может пережить
 * сессию и помешать другим сайтам. Мы их только читаем — см. {@link readCapabilities}.
 */
export async function startCamera(params: CaptureParams): Promise<MediaStream> {
  // lib.dom типизирует mediaDevices и getUserMedia как всегда присутствующие, но в
  // небезопасном контексте (http) и в части мобильных браузеров их нет вовсе — проверка
  // рантайм-обязательна, поэтому правило снимается точечно.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CameraAccessError(
      'Браузер не поддерживает доступ к камере',
      'NotSupportedError'
    )
  }

  try {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        width: params.width,
        height: params.height,
        frameRate: { ideal: 30 },
        facingMode: 'user',
      },
      audio: false,
    })
  } catch (error) {
    const reason = error instanceof DOMException ? error.name : 'UnknownError'
    throw new CameraAccessError('Нет доступа к камере', reason)
  }
}

/** Останавливает все дорожки потока. Без этого индикатор камеры продолжает гореть. */
export function stopCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => {
    track.stop()
  })
}

/**
 * Читает — и только читает — возможности камеры.
 *
 * Калибровке нужно знать, на каком железе снималось: одна и та же заливка на камере с агрессивным
 * автобалансом даёт совсем другой отклик, чем на камере без него. Отправляем прочитанное в `meta`,
 * ничего не применяя.
 */
export function readCapabilities(stream: MediaStream): CaptureCapabilities {
  const capabilities: CaptureCapabilities = {}

  try {
    capabilities.supported =
      navigator.mediaDevices.getSupportedConstraints() as unknown as Record<
        string,
        boolean
      >
  } catch {
    // Чтение возможностей — диагностика для калибровки, а не условие работы. Если браузер его
    // не даёт, вход обязан продолжиться: без этих данных калибровка будет беднее, но попытка
    // пользователя не должна падать из-за необязательной телеметрии.
  }

  try {
    const track = stream.getVideoTracks()[0]
    // getCapabilities отсутствует в Firefox и части Safari — типы этого не отражают.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    capabilities.track = track?.getCapabilities?.() as unknown as Record<
      string,
      unknown
    >
  } catch {
    // То же самое: getCapabilities отсутствует в Firefox и части Safari.
  }

  return capabilities
}

/**
 * Подписка на кадры камеры с настоящим временем кадра.
 *
 * `requestVideoFrameCallback` даёт `mediaTime` — момент, когда кадр был СНЯТ, а не когда до него
 * дошли руки. Разница между ними — задержка конвейера браузера, и она растёт под нагрузкой.
 * Пометив кадр временем обработки, мы приписали бы его следующему цвету и своими руками испортили
 * корреляцию, которую проверяет сервер.
 *
 * В Firefox этого API нет (§D11), поэтому есть запасной путь на таймере. Он честно хуже: время
 * там — момент срабатывания таймера, то есть с той самой погрешностью. Возвращаемый флаг
 * `precise` уходит в `meta`, чтобы калибровка могла отделить такие серии.
 */
export function subscribeToFrames(
  video: HTMLVideoElement,
  targetFps: number,
  onFrame: (frameTimeMs: number) => void
): { stop: () => void; precise: boolean } {
  // Метод объявлен в lib.dom, но в Firefox его нет в рантайме — проверяем существование,
  // а не тип. TypeScript об этом расхождении не знает и знать не может: lib.dom описывает
  // спецификацию, а не то, что реализовал конкретный браузер.
  if (typeof video.requestVideoFrameCallback === 'function') {
    let handle = 0
    let stopped = false
    const startedAt = performance.now()

    const tick: VideoFrameRequestCallback = (now) => {
      if (stopped) {
        return
      }
      onFrame(now - startedAt)
      handle = video.requestVideoFrameCallback(tick)
    }

    handle = video.requestVideoFrameCallback(tick)

    return {
      precise: true,
      stop: () => {
        stopped = true
        // Парная requestVideoFrameCallback есть не везде, где есть сам вызов.
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        video.cancelVideoFrameCallback?.(handle)
      },
    }
  }

  const intervalMs = 1000 / Math.max(targetFps, 1)
  const startedAt = performance.now()
  const timer = window.setInterval(() => {
    onFrame(performance.now() - startedAt)
  }, intervalMs)

  return {
    precise: false,
    stop: () => {
      window.clearInterval(timer)
    },
  }
}

/**
 * Снимает текущий кадр видео в JPEG.
 *
 * Ни масштабирования, ни зеркалирования, ни фильтров (§D11). Зеркалирование особенно
 * соблазнительно — превью с камеры принято показывать зеркальным, так привычнее, — но отражать
 * надо ПРЕВЬЮ средствами CSS, а не то, что уходит на сервер.
 */
export function grabFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob | null> {
  const context = canvas.getContext('2d', { willReadFrequently: false })
  if (!context) {
    return Promise.resolve(null)
  }

  context.drawImage(video, 0, 0, canvas.width, canvas.height)

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        resolve(blob)
      },
      'image/jpeg',
      quality
    )
  })
}
