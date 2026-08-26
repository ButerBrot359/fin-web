import { requestRefresh } from './auth-endpoints'
import { emitSessionExpired } from './session-events'
import {
  clearSession,
  getRefreshToken,
  saveRefreshedSession,
} from './token-storage'

/**
 * Продление сессии в одном экземпляре.
 *
 * <b>Почему single-flight обязателен.</b> Access-токен живёт минуты и истекает у всех
 * запросов разом. Открытая страница легко шлёт пять-шесть параллельных запросов; без
 * этой защиты каждый из них, получив 401, пошёл бы продлевать сессию сам. Пять
 * одновременных `POST /api/auth/refresh` — это пять записей в `refresh_token`, гонка за
 * то, чей ответ последним ляжет в localStorage, и как следствие — потерянный токен и
 * разлогин на ровном месте. Здесь же первый вызов делает работу, остальные ждут его
 * промис.
 */
let inFlightRefresh: Promise<string | null> | null = null

const doRefresh = async (): Promise<string | null> => {
  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    clearSession()
    emitSessionExpired()
    return null
  }

  try {
    const tokens = await requestRefresh(refreshToken)
    saveRefreshedSession(tokens.accessToken, tokens.refreshToken, tokens.user)
    return tokens.accessToken
  } catch {
    // Любой отказ продления — конец сессии: refresh истёк по бездействию, отозван при
    // смене пароля или пользователя перестали пускать. Различать эти случаи для клиента
    // незачем — действие одно: на экран входа.
    clearSession()
    emitSessionExpired()
    return null
  }
}

/**
 * @returns новый access-токен либо `null`, если продлить не удалось. `null` означает, что
 *          сессия уже стёрта и событие о её конце разослано — вызывающему коду остаётся
 *          только не повторять запрос.
 */
export const refreshSession = (): Promise<string | null> => {
  if (inFlightRefresh) return inFlightRefresh

  inFlightRefresh = doRefresh().finally(() => {
    inFlightRefresh = null
  })

  return inFlightRefresh
}
