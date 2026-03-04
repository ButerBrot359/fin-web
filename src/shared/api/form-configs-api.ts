import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios'

import type { RequestConfig } from '@/shared/types/api.types'

const instance = axios.create({
  baseURL: import.meta.env.VITE_FORM_CONFIGS_URL,
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

export const formConfigsApi = {
  get,
}
