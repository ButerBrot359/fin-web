import { create } from 'zustand'

import { requestLogin, requestLogout } from '@/shared/api/auth/auth-endpoints'
import {
  clearSession,
  getAccessToken,
  getStoredUser,
  getRefreshToken,
  saveLastLogin,
  saveSession,
} from '@/shared/api/auth/token-storage'
import type { CurrentUser } from '@/shared/types/auth.types'

/**
 * `unknown` — состояние до восстановления из хранилища. Отличать его от `anonymous`
 * обязательно: иначе гвард на первом же рендере, ещё не прочитав localStorage, выкинул бы
 * на экран входа уже вошедшего пользователя — «мигание» логина после каждой перезагрузки.
 */
export type AuthStatus = 'unknown' | 'authenticated' | 'anonymous'

interface AuthState {
  status: AuthStatus
  user: CurrentUser | null
  /**
   * Сессия оборвалась сама, а не по кнопке «выход».
   *
   * Нужен, потому что гвард различить эти случаи не может: и «никогда не входил», и
   * «истекло по бездействию» — одинаковый `anonymous`. Без флага человек оказывался бы на
   * пустой форме входа посреди работы без единого объяснения, почему.
   */
  sessionExpired: boolean
  /** Восстановление сессии из localStorage при старте приложения. */
  restore: () => void
  /** @throws ошибку axios с телом `ApiErrorBody` — текст отказа показывает форма входа. */
  signIn: (login: string, password: string) => Promise<CurrentUser>
  signOut: () => Promise<void>
  /** Сессия закончилась не по воле пользователя (refresh истёк, доступ отозван). */
  handleSessionExpired: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'unknown',
  user: null,
  sessionExpired: false,

  restore: () => {
    const token = getAccessToken()
    const user = getStoredUser()
    if (token && user) {
      // Токен не проверяется здесь намеренно: поход на сервер до первого кадра задержал бы
      // отрисовку всего приложения ради случая «токен успел протухнуть». Негодный токен
      // всё равно вскроется на первом же запросе — интерсептор продлит сессию или
      // объявит её законченной.
      set({ status: 'authenticated', user })
      return
    }
    set({ status: 'anonymous', user: null })
  },

  signIn: async (login, password) => {
    const tokens = await requestLogin({ login, password })
    saveSession(tokens.accessToken, tokens.refreshToken, tokens.user)
    // Запоминаем КАНОНИЧЕСКОЕ написание логина — то, что вернул сервер, а не то, что
    // набрали. Иначе введённое «  АЙБАС   Сара » осело бы в предзаполнении поля и в
    // выпадашке ровно в таком виде: на вход это не влияет (сервер нормализует), но
    // человек каждый раз видел бы собственную опечатку вместо «Айбас Сара».
    // Запасной вариант — введённое значение: без него пустой ответ сервера стёр бы память.
    saveLastLogin(tokens.user.login || login)
    set({ status: 'authenticated', user: tokens.user, sessionExpired: false })
    return tokens.user
  },

  signOut: async () => {
    const refreshToken = getRefreshToken()
    // Локальное состояние чистим ПЕРВЫМ и не ждём сервер: выход обязан сработать даже
    // при недоступном бэкенде, иначе пользователь остаётся в системе на чужой машине.
    // Отзыв refresh-токена на сервере — попытка; провалилась — токен умрёт по своему TTL.
    clearSession()
    // Осознанный выход — не «истекла»: сообщать человеку, что его выкинуло, когда он сам
    // нажал «выйти», значит врать.
    set({ status: 'anonymous', user: null, sessionExpired: false })
    if (!refreshToken) return
    try {
      await requestLogout(refreshToken)
    } catch {
      // см. выше
    }
  },

  handleSessionExpired: () => {
    clearSession()
    set({ status: 'anonymous', user: null, sessionExpired: true })
  },
}))
