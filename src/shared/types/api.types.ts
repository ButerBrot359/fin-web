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
