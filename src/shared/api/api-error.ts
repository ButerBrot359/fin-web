import { AxiosError } from 'axios'

/**
 * Сбой ТРАНСПОРТА — осмысленного ответа бэкенда нет вообще:
 *  - `timeout`  — сработал клиентский таймаут axios (ECONNABORTED/ETIMEDOUT);
 *  - `network`  — соединение оборвалось, ответа не было (ERR_NETWORK и т.п.);
 *  - `gateway`  — ответил ПРОКСИ (nginx-ingress), а не приложение: 504/502/408.
 *
 * Ключевое отличие от обычной ошибки API: при таких сбоях запрос мог быть
 * ПРИНЯТ и ДОСЧИТАН на сервере (например, проведение документа с большой ТЧ
 * продолжается в транзакции после того, как ingress разорвал соединение на 60 с).
 * Поэтому UI обязан показывать не «ошибка сохранения», а «операция продолжается
 * на сервере, не повторяйте» — иначе пользователь жмёт кнопку ещё раз и плодит дубли.
 */
export type ApiTransportErrorKind = 'timeout' | 'network' | 'gateway'

// Сообщение технического уровня — для консоли и для мест, которые читают
// `error.message` напрямую. Пользовательский текст с рекомендацией даёт вызывающий
// код через i18n (см. use-document-entry-actions).
const KIND_MESSAGES: Record<ApiTransportErrorKind, string> = {
  timeout: 'Превышено время ожидания ответа сервера',
  network: 'Соединение с сервером прервано',
  gateway: 'Шлюз разорвал соединение, не дождавшись ответа сервера',
}

export class ApiTransportError extends Error {
  readonly kind: ApiTransportErrorKind
  readonly status?: number

  constructor(kind: ApiTransportErrorKind, status?: number) {
    super(KIND_MESSAGES[kind])
    this.name = 'ApiTransportError'
    this.kind = kind
    this.status = status
  }
}

export const isApiTransportError = (
  error: unknown
): error is ApiTransportError => error instanceof ApiTransportError

/**
 * HTTP 409 от бэкенда — конфликт блокировок (SCRUM-330): объект занят другим
 * пользователем/фоновой задачей (`OBJECT_LOCKED`) либо доменная блокировка
 * (`LOCK_CONFLICT`). `message` бэка — готовый русский текст «кем занято»,
 * показывается пользователю как есть; операция НЕ выполнена, данные целы —
 * корректная реакция UI: warning-тост и возможность повторить, не error.
 */
export class ApiConflictError extends Error {
  readonly status = 409
  /** `OBJECT_LOCKED` | `LOCK_CONFLICT` | '' (неопознанное тело). */
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'ApiConflictError'
    this.code = code
  }
}

export const isApiConflictError = (error: unknown): error is ApiConflictError =>
  error instanceof ApiConflictError

/**
 * Тело 409 нормализуем по образцу SDUI (`normalize-conflict.ts`): код — из
 * `code` либо `error`, текст — из стандартного `message`. Пустой message —
 * забота вызывающего (i18n-фолбэк по коду).
 */
export const apiConflictErrorFromBody = (body: unknown): ApiConflictError => {
  const b = (body && typeof body === 'object' ? body : {}) as Record<
    string,
    unknown
  >
  const code =
    (typeof b.code === 'string' && b.code) ||
    (typeof b.error === 'string' && b.error) ||
    ''
  const message = typeof b.message === 'string' ? b.message : ''
  return new ApiConflictError(code, message)
}

/**
 * Статусы, которые в нашей инсталляции отдаёт ШЛЮЗ, а не приложение: тело такого
 * ответа — html-заглушка nginx, показывать её пользователю бессмысленно.
 * 503 сюда НЕ входит: это «сервис недоступен», запрос до приложения не дошёл и
 * ничего на сервере не продолжается — обычная ошибка.
 */
const GATEWAY_TIMEOUT_STATUSES = new Set([408, 502, 504])

/**
 * @returns вид транспортного сбоя либо `null`, если это нормальный ответ API с
 * телом (4xx-валидация и пр.) или отмена запроса — их обрабатываем как раньше.
 */
export const classifyTransportFailure = (
  error: AxiosError
): ApiTransportErrorKind | null => {
  // Отмена (AbortSignal / смена ключа в TanStack Query) — не сбой: поведение
  // прежнее, иначе отменённые запросы начали бы показывать тосты.
  if (error.code === AxiosError.ERR_CANCELED) return null

  if (
    error.code === AxiosError.ECONNABORTED ||
    error.code === AxiosError.ETIMEDOUT
  ) {
    return 'timeout'
  }

  const status = error.response?.status
  if (status === undefined) return 'network'

  return GATEWAY_TIMEOUT_STATUSES.has(status) ? 'gateway' : null
}
