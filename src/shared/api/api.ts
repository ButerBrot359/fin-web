import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios'

import i18n from '@/app/config/i18n'
import type {
  BlobRequestConfig,
  RequestConfig,
  RequestWithDataConfig,
} from '@/shared/types/api.types'

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Текущий язык шлём на бэкенд заголовком `Accept-Language` на КАЖДЫЙ запрос.
// `i18n.language` читаем динамически внутри интерсептора (а не один раз на старте):
// после `i18n.changeLanguage` следующий запрос уходит уже с новым языком — инстанс
// пересоздавать не нужно. По этому заголовку бэкенд локализует серверно-рендеримый
// контент отчётов (бланк мемориального ордера, titleTemplate): `kz` → казахский,
// `ru`/пусто → русский. Интерсептор навешан только на этот инстанс; SDUI-транспорт
// (`features/sdui/api/view-transport.ts`) — отдельный axios-инстанс и не затрагивается.
instance.interceptors.request.use((config) => {
  config.headers.set('Accept-Language', i18n.language)
  return config
})

const makeRequest = <T>(
  config: AxiosRequestConfig
): Promise<AxiosResponse<T>> =>
  instance.request<T>(config).catch((error: unknown) => {
    if (error instanceof AxiosError) {
      throw error.response?.data
    }
    throw error
  })

const get = <T = unknown>({ url, params, signal }: RequestConfig) =>
  makeRequest<T>({ method: 'GET', url, params, signal })

const post = <T = unknown>({
  url,
  data,
  params,
  signal,
}: RequestWithDataConfig) =>
  makeRequest<T>({ method: 'POST', url, data, params, signal })

// FormData ДОЛЖНА уйти как `multipart/form-data; boundary=...`. У инстанса задан
// дефолтный `Content-Type: application/json` — он НЕ сбрасывается сам, поэтому
// FormData уезжала бы как JSON и Spring отвечал бы 415. Сбрасываем заголовок в
// `undefined`: тогда axios, увидев FormData, сам проставит multipart с boundary.
const postFormData = <T = unknown>({
  url,
  data,
  params,
  signal,
}: RequestWithDataConfig) =>
  makeRequest<T>({
    method: 'POST',
    url,
    data,
    params,
    signal,
    headers: { 'Content-Type': undefined } as AxiosRequestConfig['headers'],
  })

const put = <T = unknown>({ url, data, signal }: RequestWithDataConfig) =>
  makeRequest<T>({ method: 'PUT', url, data, signal })

const patch = <T = unknown>({ url, data, signal }: RequestWithDataConfig) =>
  makeRequest<T>({ method: 'PATCH', url, data, signal })

const _delete = <T = unknown>({
  url,
  data,
  params,
  signal,
}: RequestWithDataConfig) =>
  makeRequest<T>({ method: 'DELETE', url, data, params, signal })

const getFileBlob = ({ url, params, signal }: RequestConfig) =>
  makeRequest<Blob>({
    method: 'GET',
    url,
    params,
    responseType: 'blob',
    signal,
  })

const postFileBlob = ({ url, data, params, signal }: BlobRequestConfig) =>
  makeRequest<Blob>({
    method: 'POST',
    url,
    data,
    params,
    responseType: 'blob',
    signal,
  })

export const apiService = {
  get,
  post,
  postFormData,
  put,
  patch,
  delete: _delete,
  getFileBlob,
  postFileBlob,
}
