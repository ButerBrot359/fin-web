import type { AxiosError } from 'axios'
import axios from 'axios'

import type { TokenPair } from '@/shared/types/auth.types'

import type {
  CapturedFrame,
  FaceChallengeResponse,
  FaceQualityReason,
  FaceVerifyOutcome,
  VerifyMeta,
} from '../types/face-auth'

/**
 * HTTP-вызовы входа по лицу (ADR-0069 §D11).
 *
 * Отдельный инстанс axios без auth-интерсепторов — по той же причине, что и у обычного входа:
 * на экране входа токена нет, подставлять заголовок `Authorization` не из чего, а интерсептор
 * ответа, поймав 401, ушёл бы продлевать несуществующую сессию.
 */
const faceAuthInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  /**
   * Дольше, чем у обычного входа: на остывшем движке распознавания ответ приходит через
   * 8–10 секунд (измерено, ADR-0069 §D13). Сервер в этом случае ответит 503 и НЕ израсходует
   * попытку, но дождаться этого ответа мы обязаны — иначе пользователь увидит сетевую ошибку
   * там, где сервер честно сказал «движок занят, войдите паролем».
   */
  timeout: 45_000,
})

export const FACE_AUTH_PATHS = {
  challenge: '/api/auth/face/challenge',
  verify: '/api/auth/face/verify',
} as const

/** Перечень §D11. Всё, чего здесь нет, показывать пользователю как причину нельзя. */
const QUALITY_REASONS: readonly FaceQualityReason[] = [
  'NO_FACE',
  'MULTIPLE_FACES',
  'FACE_TOO_SMALL',
  'FACE_TOO_LARGE',
  'FACE_MOVED',
  'LOW_FRAME_RATE',
  'LOW_SIGNAL',
  'TOO_FEW_FRAMES',
  'TOO_MANY_FRAMES',
]

const isQualityReason = (value: unknown): value is FaceQualityReason =>
  typeof value === 'string' &&
  QUALITY_REASONS.includes(value as FaceQualityReason)

/**
 * Шаг 1: получить световое расписание.
 *
 * Логин уходит в том же виде, что и при обычном входе — нормализацию делает сервер по своим
 * правилам, и клиентская «помощь» здесь может только разойтись с серверной.
 */
export const requestFaceChallenge = async (
  login: string
): Promise<FaceChallengeResponse> => {
  const { data } = await faceAuthInstance.post<FaceChallengeResponse>(
    FACE_AUTH_PATHS.challenge,
    { login }
  )
  return data
}

/**
 * Шаг 2: отправить снятую серию.
 *
 * ПОРЯДОК ЧАСТЕЙ ЗНАЧИМ (§D11): кадры добавляются строго по возрастанию `n`, а `meta.frames`
 * описывает их в том же порядке. Сервер сопоставляет кадр с сегментом расписания по этому
 * соответствию — перестановка сломает временную корреляцию, и живой человек получит отказ.
 */
export const verifyFaceSeries = async (
  challengeId: string,
  meta: VerifyMeta,
  frames: CapturedFrame[]
): Promise<FaceVerifyOutcome> => {
  const form = new FormData()
  form.append('challengeId', challengeId)
  form.append(
    'meta',
    new Blob([JSON.stringify(meta)], { type: 'application/json' })
  )

  const ordered = [...frames].sort((a, b) => a.meta.n - b.meta.n)
  for (const frame of ordered) {
    const name = `frame_${String(frame.meta.n).padStart(3, '0')}.jpg`
    form.append('frames', frame.blob, name)
  }

  try {
    const { data } = await faceAuthInstance.post<TokenPair>(
      FACE_AUTH_PATHS.verify,
      form
    )
    return { kind: 'success', tokens: data }
  } catch (error) {
    return toOutcome(error)
  }
}

/**
 * Раскладывает ответ сервера в исход, на который реагирует UI.
 *
 * 401 намеренно не несёт причины: живость и несовпадение личности сервер не различает в ответе,
 * чтобы подбор не получал обратной связи. Показывать здесь что-то кроме общего «не удалось» —
 * значит выдумать причину, которой сервер не называл.
 */
const toOutcome = (error: unknown): FaceVerifyOutcome => {
  if (!axios.isAxiosError(error)) {
    return { kind: 'clientError', detail: String(error) }
  }

  const axiosError = error as AxiosError<{ reason?: unknown }>
  const status = axiosError.response?.status

  switch (status) {
    case 401:
      return { kind: 'rejected' }
    case 422: {
      // Тело ошибки типизировано как непустое, но 422 может прийти и без него (прокси,
      // gateway): сужаем к optional и читаем reason безопасно.
      const data = axiosError.response?.data as { reason?: unknown } | undefined
      const reason = data?.reason
      return isQualityReason(reason)
        ? { kind: 'quality', reason }
        : { kind: 'rejected' }
    }
    case 429:
      return { kind: 'rateLimited' }
    case 503:
      return { kind: 'unavailable' }
    default:
      return { kind: 'clientError', detail: axiosError.message }
  }
}

/** Отдельно от {@link toOutcome} — нужна тестам и разбору отказов шага 1. */
export const mapVerifyError = toOutcome
