import type { RefObject } from 'react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

/** Клавиши, которые нажимаются в webbuh и должны доехать как есть. */
const FORWARDED_KEYS = new Set([
  'Enter',
  'Escape',
  'Tab',
  'Backspace',
  'Delete',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
])

interface Action {
  action: 'move' | 'click' | 'dblclick' | 'scroll' | 'key'
  x: number
  y: number
  dx?: number
  dy?: number
  key?: string
}

/**
 * Поверхность управления у агента (ADR-0050).
 *
 * <p>Прозрачный слой поверх показанного экрана: он перехватывает мышь и клавиатуру агента и
 * пересчитывает их в доли кадра. Слой нужен именно как отдельный элемент — без него щелчки
 * уходили бы в собственный интерфейс агента, а не в чужой экран.
 *
 * <p><b>Пересчёт учитывает поля по краям.</b> Видео вписано в плитку по `object-fit: contain`,
 * то есть картинка занимает не всю плитку, а её середину с чёрными полосами. Считать долю от
 * размера плитки значило бы промахиваться тем сильнее, чем сильнее не совпадают пропорции
 * экранов — а промах мимо кнопки в бухгалтерии стоит дорого.
 */
export const RemoteControlSurface = ({
  stageRef,
  onAction,
}: {
  /** Контейнер сцены: внутри него ищется элемент `video` с показанным экраном. */
  stageRef: RefObject<HTMLElement | null>
  onAction: (action: Action) => void
}) => {
  const { t } = useTranslation()
  const surfaceRef = useRef<HTMLDivElement>(null)

  // Где последний раз стоял курсор агента. Нужна для клавиатуры: поле ввода на чужой стороне
  // ищется по точке, а не по фокусу — фокус живёт в браузере агента и о чужой странице
  // не знает ничего.
  const lastPoint = useRef({ x: 0, y: 0 })

  // Фокус нужен, чтобы ловить клавиатуру: без него нажатия уходят в документ агента.
  useEffect(() => {
    surfaceRef.current?.focus()
  }, [])

  /** Точка курсора → доли кадра. `null`, когда курсор попал в поле за краем картинки. */
  const toShare = (clientX: number, clientY: number) => {
    const video = stageRef.current?.querySelector('video')
    if (!video?.videoWidth || !video.videoHeight) {
      return null
    }
    const box = video.getBoundingClientRect()
    const scale = Math.min(
      box.width / video.videoWidth,
      box.height / video.videoHeight
    )
    const shownWidth = video.videoWidth * scale
    const shownHeight = video.videoHeight * scale
    const left = box.left + (box.width - shownWidth) / 2
    const top = box.top + (box.height - shownHeight) / 2

    const x = (clientX - left) / shownWidth
    const y = (clientY - top) / shownHeight
    return x < 0 || x > 1 || y < 0 || y > 1 ? null : { x, y }
  }

  const at = (event: { clientX: number; clientY: number }) =>
    toShare(event.clientX, event.clientY)

  return (
    <div
      ref={surfaceRef}
      tabIndex={0}
      role="application"
      aria-label={t('support.controlSurface')}
      className="absolute inset-0 z-10 cursor-crosshair outline-none"
      onPointerMove={(event) => {
        lastPoint.current = { x: event.clientX, y: event.clientY }
        const point = at(event)
        if (point) {
          onAction({ action: 'move', ...point })
        }
      }}
      onClick={(event) => {
        const point = at(event)
        if (point) {
          onAction({ action: 'click', ...point })
        }
      }}
      onDoubleClick={(event) => {
        const point = at(event)
        if (point) {
          onAction({ action: 'dblclick', ...point })
        }
      }}
      onWheel={(event) => {
        const point = at(event)
        if (point) {
          onAction({
            action: 'scroll',
            ...point,
            dx: event.deltaX,
            dy: event.deltaY,
          })
        }
      }}
      onKeyDown={(event) => {
        // Сочетания с Ctrl и Alt не пересылаем: это команды браузера агента (обновить
        // страницу, закрыть вкладку), и на чужой стороне они означали бы совсем другое.
        if (event.ctrlKey || event.altKey || event.metaKey) {
          return
        }
        const printable = event.key.length === 1
        if (!printable && !FORWARDED_KEYS.has(event.key)) {
          return
        }
        event.preventDefault()

        const point = toShare(lastPoint.current.x, lastPoint.current.y)
        if (point) {
          onAction({ action: 'key', ...point, key: event.key })
        }
      }}
      onPointerDown={(event) => {
        lastPoint.current = { x: event.clientX, y: event.clientY }
        surfaceRef.current?.focus()
      }}
    />
  )
}
