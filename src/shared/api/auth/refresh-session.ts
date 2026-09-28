import { requestRefresh } from './auth-endpoints'
import { emitSessionExpired } from './session-events'
import {
  clearSession,
  getAccessToken,
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
 *
 * <b>Почему ещё и межвкладочный замок (SCRUM-308 v5 §6).</b> Промис выше живёт в одной
 * вкладке, а localStorage общий: две вкладки, поймав 401 одновременно, продлевали сессию
 * одним и тем же refresh-токеном. При ротации токена на сервере второй запрос приходил
 * с уже сожжённым токеном и разлогинивал обе вкладки. Web Locks сериализует продление
 * между вкладками; дождавшийся замка перечитывает access из localStorage — если тот
 * сменился, сосед уже всё сделал, и жечь refresh второй раз не нужно.
 */
let inFlightRefresh: Promise<string | null> | null = null

/** Имя межвкладочного замка Web Locks. */
const REFRESH_LOCK = 'webbuh.auth.refresh'

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

const doRefreshCrossTab = async (): Promise<string | null> => {
  // Access на момент 401 — снимается ДО ожидания замка: если за время ожидания
  // токен в localStorage сменился, продление уже сделала соседняя вкладка.
  const staleAccess = getAccessToken()
  const refreshUnlessNeighborDid = async (): Promise<string | null> => {
    const current = getAccessToken()
    if (current && current !== staleAccess) return current
    return doRefresh()
  }

  // Средам без Web Locks (старые встроенные браузеры) остаётся одновкладочный
  // single-flight — как было до этой правки.
  if (typeof navigator !== 'undefined' && 'locks' in navigator) {
    return navigator.locks.request(REFRESH_LOCK, refreshUnlessNeighborDid)
  }
  return refreshUnlessNeighborDid()
}

/**
 * @returns новый access-токен либо `null`, если продлить не удалось. `null` означает, что
 *          сессия уже стёрта и событие о её конце разослано — вызывающему коду остаётся
 *          только не повторять запрос.
 */
export const refreshSession = (): Promise<string | null> => {
  if (inFlightRefresh) return inFlightRefresh

  inFlightRefresh = doRefreshCrossTab().finally(() => {
    inFlightRefresh = null
  })

  return inFlightRefresh
}
