export interface RequestConfig {
  url: string
  params?: Record<string, unknown>
  signal?: AbortSignal
  /**
   * Переопределение таймаута запроса, мс. По умолчанию действует
   * `DEFAULT_TIMEOUT_MS` из `shared/api/api.ts`; долгим операциям (запись и
   * проведение документа с большой ТЧ) передаём `LONG_OPERATION_TIMEOUT_MS`,
   * чтобы не оборвать запрос раньше сервера. `0` — без таймаута.
   */
  timeout?: number
}

export interface RequestWithDataConfig extends RequestConfig {
  data?: unknown
}

export interface BlobRequestConfig extends RequestConfig {
  data?: unknown
}

export interface ApiResponse<T> {
  data: T
  success: boolean
}

export interface ApiErrorDetail {
  attributeCode?: string
  errorCode?: string
  message?: string
}

export interface ApiErrorResponse {
  status?: number
  error?: string
  message?: string
  path?: string
  errors?: ApiErrorDetail[]
  data?: { message?: string }
}

export interface PagedResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
  first: boolean
  last: boolean
  empty: boolean
}
