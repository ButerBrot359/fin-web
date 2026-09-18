import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios'

import type {
  RequestConfig,
  RequestWithDataConfig,
} from '@/shared/types/api.types'

import { rethrowApiError } from './api-error'
import { DEFAULT_TIMEOUT_MS } from './api'

// Отдельный хост генератора конфигов форм (легаси form-renderer). Таймаут — тот
// же, что у основного клиента: без него axios ждёт бесконечно (см. api.ts).
const instance = axios.create({
  baseURL: import.meta.env.VITE_FORM_CONFIGS_URL,
  timeout: DEFAULT_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Ошибки — тем же маппингом, что у основного клиента (W-13): типизированные
// `ApiTransportError` / `ApiConflictError` / `ApiHttpError` вместо сырого тела.
const makeRequest = <T>(
  config: AxiosRequestConfig
): Promise<AxiosResponse<T>> =>
  instance.request<T>(config).catch(rethrowApiError)

const get = <T = unknown>({ url, params, signal, timeout }: RequestConfig) =>
  makeRequest<T>({ method: 'GET', url, params, signal, timeout })

// W-13: раньше `post` вообще не передавал `data` — тело запроса молча терялось.
const post = <T = unknown>({
  url,
  data,
  params,
  signal,
  timeout,
}: RequestWithDataConfig) =>
  makeRequest<T>({ method: 'POST', url, data, params, signal, timeout })

export const formConfigsApi = {
  get,
  post,
}
