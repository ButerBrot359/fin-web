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
  headers: {
    'Content-Type': 'application/json',
  },
})

const makeRequest = (
  config: AxiosRequestConfig
): Promise<AxiosResponse<unknown>> =>
  instance.request(config).catch((error: unknown) => {
    if (error instanceof AxiosError) {
      throw error.response?.data
    }
    throw error
  })

const get = ({ url, params, signal }: RequestConfig) =>
  makeRequest({ method: 'GET', url, params, signal })

const post = ({ url, data, params, signal }: RequestWithDataConfig) =>
  makeRequest({ method: 'POST', url, data, params, signal })

const put = ({ url, data, signal }: RequestWithDataConfig) =>
  makeRequest({ method: 'PUT', url, data, signal })

const patch = ({ url, data, signal }: RequestWithDataConfig) =>
  makeRequest({ method: 'PATCH', url, data, signal })

const _delete = ({ url, data, params, signal }: RequestWithDataConfig) =>
  makeRequest({ method: 'DELETE', url, data, params, signal })

const getFileBlob = ({ url, params, signal }: RequestConfig) =>
  makeRequest({ method: 'GET', url, params, responseType: 'blob', signal })

const postFileBlob = ({ url, data, params, signal }: BlobRequestConfig) =>
  makeRequest({
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
