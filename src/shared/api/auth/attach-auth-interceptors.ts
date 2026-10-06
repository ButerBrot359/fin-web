import { CanceledError } from 'axios'
import type { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios'

import { classifyAccessError, readErrorBody } from '@/shared/api/access-denied'

import { isAuthEndpoint } from './auth-endpoints'
import { getAuthGeneration } from './auth-generation'
import { refreshSession } from './refresh-session'
import {
  emitPasswordChangeRequired,
  emitSessionExpired,
} from './session-events'
import { clearSession, getAccessToken } from './token-storage'

/**
 * Запрос, для которого продление уже пробовали. Повторять его второй раз нельзя: если
 * ресурс отдаёт 401 даже со свежим токеном (право отобрали, объект чужой), цикл
 * «401 → refresh → 401» крутился бы бесконечно.
 */
type RetriableConfig = AxiosRequestConfig & {
  _authRetry?: boolean
  /** Поколение авторизации на момент отправки (SCRUM-400 §10 п.4). */
  _authGeneration?: number
}

/**
 * Ответ пришёл в ЧУЖОМ поколении личности: между отправкой и ответом случился
 * выход или вход другого пользователя. Такой ответ не должен дойти ни до
 * одного обработчика — превращаем его в отмену (ERR_CANCELED обрабатывается
 * всеми слоями как «не показывать»).
 */
const isStaleAuthGeneration = (config: unknown): boolean => {
  const stamped = (config as RetriableConfig | undefined)?._authGeneration
  return stamped !== undefined && stamped !== getAuthGeneration()
}

/**
 * Навешивает на инстанс axios подстановку Bearer-токена и автопродление сессии по 401.
 *
 * Вызывается для КАЖДОГО инстанса, который ходит в webbuh: общий клиент
 * (`shared/api/api.ts`) и SDUI-транспорт (`features/sdui/api/view-transport.ts`). Забытый
 * инстанс проявится не сразу, а только когда бэкенд включит проверку доступа: часть
 * экранов молча отвалится в 401, остальные продолжат работать.
 *
 * <b>`shared/api/form-configs-api.ts` подключать сюда НЕЛЬЗЯ.</b> Он ходит на другой хост
 * (`VITE_FORM_CONFIGS_URL`, отдельный form-configs-server), и Bearer-токен webbuh там не
 * нужен — а отправленный, он оказался бы в логах и истории запросов чужого сервиса.
 * Учётные данные уходят только на тот хост, который их выдал.
 *
 * <b>Про `navigator.sendBeacon`.</b> Закрытие SDUI-сессии уходит маяком, а маяку нельзя
 * задать заголовок — этот вызов интерсептор не покрывает и покрыть не может. При
 * включённой аутентификации закрытие сессии будет отклоняться, и она проживёт до своего
 * TTL. Отдельная задача бэкенда: либо сделать этот путь открытым, либо принимать закрытие
 * без заголовка.
 */
export const attachAuthInterceptors = (instance: AxiosInstance): void => {
  instance.interceptors.request.use((config) => {
    // Поколение фиксируется при ПЕРВОЙ отправке (retry после refresh сохраняет
    // исходное: продление сессии того же пользователя поколение не меняет).
    const retriable = config as RetriableConfig
    retriable._authGeneration ??= getAuthGeneration()
    const token = getAccessToken()
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`)
    }
    return config
  })

  instance.interceptors.response.use(
    (response) => {
      if (isStaleAuthGeneration(response.config)) {
        throw new CanceledError('auth generation changed')
      }
      return response
    },
    async (error: AxiosError) => {
      const config = error.config as RetriableConfig | undefined

      if (isStaleAuthGeneration(config)) {
        return Promise.reject(new CanceledError('auth generation changed'))
      }

      // SCRUM-400 §4.3: два 403 авторизации, которые НЕ являются отказом по правам,
      // перехватываются здесь — до любых обработчиков экранов, одинаково для
      // общего клиента и SDUI-транспорта.
      if (error.response?.status === 403) {
        const body = readErrorBody(error.response.data)
        const kind = classifyAccessError(403, body.code, body.message)
        if (kind?.kind === 'account-ineligible') {
          // Учётная запись стала недействительной: сессия мертва. Токены чистим
          // и уводим на вход с текстом сервера — «Нет доступа» здесь ложь.
          clearSession()
          emitSessionExpired(kind.message ?? undefined)
        } else if (kind?.kind === 'password-change') {
          // Обязательная смена пароля включилась ПОСЛЕ входа: гвард по
          // сохранённому пользователю её не видит — уводим событием.
          emitPasswordChangeRequired()
        }
      }

      const shouldTryRefresh =
        error.response?.status === 401 &&
        !!config &&
        !config._authRetry &&
        // Сам контур входа не продлеваем: 401 от /login означает «неверный пароль»,
        // и продлевать там нечего, а 401 от /refresh уже обработан внутри refreshSession.
        !isAuthEndpoint(config.url)

      if (!shouldTryRefresh) {
        return Promise.reject(error)
      }

      const refreshedAccessToken = await refreshSession()
      if (!refreshedAccessToken) {
        // Сессия закончилась: токены стёрты, событие разослано. Ошибку отдаём как есть —
        // вызывающий код увидит обычный 401 и не станет показывать «сохранение не удалось».
        return Promise.reject(error)
      }

      // Заголовок здесь НЕ подставляем: `instance.request` прогоняет запрос через всю
      // цепочку заново, и интерсептор выше сам возьмёт уже обновлённый токен. Правка
      // `config.headers` руками означала бы работу с AxiosHeaders как с обычным объектом
      // — источник ровно тех потерь заголовков, которые потом ищут часами.
      config._authRetry = true
      return instance.request(config)
    }
  )
}
