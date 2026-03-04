import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios'

import type {
  BlobRequestConfig,
  RequestConfig,
  RequestWithDataConfig,
} from '@/shared/types/api.types'

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL as string,
  headers: {
    'Content-Type': 'application/json',
  },
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
  put,
  patch,
  delete: _delete,
  getFileBlob,
  postFileBlob,
}
