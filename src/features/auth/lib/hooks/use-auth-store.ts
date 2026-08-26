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
    // Запоминаем логин в том написании, в каком его ВВЕЛИ, а не как он лежит в базе:
    // человек в следующий раз узнает своё собственное написание. Сервер всё равно
    // нормализует его при поиске, так что на вход это не влияет.
    saveLastLogin(login)
    set({ status: 'authenticated', user: tokens.user })
    return tokens.user
  },

  signOut: async () => {
    const refreshToken = getRefreshToken()
    // Локальное состояние чистим ПЕРВЫМ и не ждём сервер: выход обязан сработать даже
    // при недоступном бэкенде, иначе пользователь остаётся в системе на чужой машине.
    // Отзыв refresh-токена на сервере — попытка; провалилась — токен умрёт по своему TTL.
    clearSession()
    set({ status: 'anonymous', user: null })
    if (!refreshToken) return
    try {
      await requestLogout(refreshToken)
    } catch {
      // см. выше
    }
  },

  handleSessionExpired: () => {
    clearSession()
    set({ status: 'anonymous', user: null })
  },
}))
