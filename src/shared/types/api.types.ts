export interface RequestConfig {
  url: string
  params?: Record<string, unknown>
  signal?: AbortSignal
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
