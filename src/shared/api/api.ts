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

import { ApiTransportError, classifyTransportFailure } from './api-error'
import { attachAuthInterceptors } from './auth/attach-auth-interceptors'

/**
 * Таймаут обычного запроса. Без него axios ждёт БЕСКОНЕЧНО: если соединение
 * зависло, вкладка остаётся в «вечной загрузке» без единого признака проблемы.
 * Значение выровнено с nginx-ingress (~60 с): раньше него мы запрос не рвём,
 * то есть ничего работавшего не ломаем, но потолок появляется.
 */
export const DEFAULT_TIMEOUT_MS = 60_000

/**
 * Таймаут ДОЛГИХ операций (запись/проведение документа с большой табличной
 * частью: бэкенд переписывает тысячи строк ТЧ и пишет проводки в одной
 * транзакции — это законные минуты). Рвать их по обычному таймауту нельзя:
 * клиент уже показал бы ошибку, а транзакция на сервере всё равно доедет до
 * конца. Ставим заведомо больше серверного потолка, чтобы первым обрыв
 * инициировал сервер/шлюз, а не мы.
 */
export const LONG_OPERATION_TIMEOUT_MS = 15 * 60_000

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: DEFAULT_TIMEOUT_MS,
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

// Bearer-токен на каждый запрос и автопродление сессии по 401 (SCRUM-373). Навешивается
// ПОСЛЕ Accept-Language: интерсепторы запроса выполняются в порядке регистрации, и токен
// подставляется последним — на уже сформированный конфиг.
attachAuthInterceptors(instance)

const makeRequest = <T>(
  config: AxiosRequestConfig
): Promise<AxiosResponse<T>> =>
  instance.request<T>(config).catch((error: unknown) => {
    if (error instanceof AxiosError) {
      // Обрыв транспорта (таймаут / нет сети / 504 от ingress): тела ответа либо
      // нет вовсе, либо это html-заглушка шлюза — прокидывать её наверх нельзя,
      // раньше в таком случае наружу летел `undefined` и UI не мог отличить
      // «сервер всё ещё считает» от ошибки валидации. Даём типизированную ошибку.
      const transportKind = classifyTransportFailure(error)
      if (transportKind) {
        throw new ApiTransportError(transportKind, error.response?.status)
      }
      throw error.response?.data
    }
    throw error
  })

const get = <T = unknown>({ url, params, signal, timeout }: RequestConfig) =>
  makeRequest<T>({ method: 'GET', url, params, signal, timeout })

const post = <T = unknown>({
  url,
  data,
  params,
  signal,
  timeout,
}: RequestWithDataConfig) =>
  makeRequest<T>({ method: 'POST', url, data, params, signal, timeout })

// FormData ДОЛЖНА уйти как `multipart/form-data; boundary=...`. У инстанса задан
// дефолтный `Content-Type: application/json` — он НЕ сбрасывается сам, поэтому
// FormData уезжала бы как JSON и Spring отвечал бы 415. Сбрасываем заголовок в
// `undefined`: тогда axios, увидев FormData, сам проставит multipart с boundary.
const postFormData = <T = unknown>({
  url,
  data,
  params,
  signal,
  timeout,
}: RequestWithDataConfig) =>
  makeRequest<T>({
    method: 'POST',
    url,
    data,
    params,
    signal,
    timeout,
    headers: { 'Content-Type': undefined } as AxiosRequestConfig['headers'],
  })

const put = <T = unknown>({
  url,
  data,
  signal,
  timeout,
}: RequestWithDataConfig) =>
  makeRequest<T>({ method: 'PUT', url, data, signal, timeout })

const patch = <T = unknown>({
  url,
  data,
  signal,
  timeout,
}: RequestWithDataConfig) =>
  makeRequest<T>({ method: 'PATCH', url, data, signal, timeout })

const _delete = <T = unknown>({
  url,
  data,
  params,
  signal,
  timeout,
}: RequestWithDataConfig) =>
  makeRequest<T>({ method: 'DELETE', url, data, params, signal, timeout })

const getFileBlob = ({ url, params, signal, timeout }: RequestConfig) =>
  makeRequest<Blob>({
    method: 'GET',
    url,
    params,
    responseType: 'blob',
    signal,
    timeout,
  })

const postFileBlob = ({
  url,
  data,
  params,
  signal,
  timeout,
}: BlobRequestConfig) =>
  makeRequest<Blob>({
    method: 'POST',
    url,
    data,
    params,
    responseType: 'blob',
    signal,
    timeout,
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
