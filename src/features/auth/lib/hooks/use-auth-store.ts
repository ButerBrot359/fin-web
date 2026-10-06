import { create } from 'zustand'

import { requestLogin, requestLogout } from '@/shared/api/auth/auth-endpoints'
import { bumpAuthGeneration } from '@/shared/api/auth/auth-generation'
import {
  notifySignedIn,
  runBeforeSignOut,
  runIdentityReset,
} from '@/shared/api/auth/auth-lifecycle'
import {
  clearSession,
  getAccessToken,
  getStoredUser,
  getRefreshToken,
  saveLastLogin,
  saveSession,
} from '@/shared/api/auth/token-storage'
import type { CurrentUser, TokenPair } from '@/shared/types/auth.types'

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
  /**
   * Серверный текст причины обрыва (SCRUM-400: `403 ACCOUNT_INELIGIBLE` несёт
   * «Вход запрещён: …»). null — причина общая, форма входа показывает свой текст.
   */
  sessionExpiredMessage: string | null
  /** Восстановление сессии из localStorage при старте приложения. */
  restore: () => void
  /** @throws ошибку axios с телом `ApiErrorBody` — текст отказа показывает форма входа. */
  signIn: (login: string, password: string) => Promise<CurrentUser>
  /**
   * Завести сессию по уже полученным токенам.
   *
   * Нужен входу по лицу: тот сам ходит к серверу (у него свой протокол со съёмкой серии кадров)
   * и приносит готовый `TokenPair`. Всё, что происходит ПОСЛЕ получения токенов, обязано быть
   * общим с парольным входом — иначе два способа входа со временем разойдутся в мелочах вроде
   * запоминания логина, и расхождение вылезет не сразу.
   */
  completeSignIn: (tokens: TokenPair, fallbackLogin: string) => CurrentUser
  signOut: () => Promise<void>
  /** Сессия закончилась не по воле пользователя (refresh истёк, доступ отозван). */
  handleSessionExpired: (message?: string) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'unknown',
  user: null,
  sessionExpired: false,
  sessionExpiredMessage: null,

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
    return get().completeSignIn(tokens, login)
  },

  completeSignIn: (tokens, fallbackLogin) => {
    saveSession(tokens.accessToken, tokens.refreshToken, tokens.user)
    // Запоминаем КАНОНИЧЕСКОЕ написание логина — то, что вернул сервер, а не то, что
    // набрали. Иначе введённое «  АЙБАС   Сара » осело бы в предзаполнении поля и в
    // выпадашке ровно в таком виде: на вход это не влияет (сервер нормализует), но
    // человек каждый раз видел бы собственную опечатку вместо «Айбас Сара».
    // Запасной вариант — введённое значение: без него пустой ответ сервера стёр бы память.
    saveLastLogin(tokens.user.login || fallbackLogin)
    // SCRUM-400 §10: новое поколение личности (поздние ответы прежней
    // отбрасываются); вход ДРУГОГО пользователя дополнительно сбрасывает кэши.
    bumpAuthGeneration()
    notifySignedIn(tokens.user.id)
    set({
      status: 'authenticated',
      user: tokens.user,
      sessionExpired: false,
      sessionExpiredMessage: null,
    })
    return tokens.user
  },

  signOut: async () => {
    const refreshToken = getRefreshToken()
    // SCRUM-400 §10 п.1: SDUI-сессии закрываются ДО очистки токенов (после неё
    // CLOSE ответил бы 401) — с потолком по времени, выход не зависает.
    await runBeforeSignOut()
    // Локальное состояние чистим ПЕРВЫМ и не ждём сервер: выход обязан сработать даже
    // при недоступном бэкенде, иначе пользователь остаётся в системе на чужой машине.
    // Отзыв refresh-токена на сервере — попытка; провалилась — токен умрёт по своему TTL.
    clearSession()
    // Поздние ответы этого пользователя — в мусор; кэши и SDUI-состояние — сброс.
    bumpAuthGeneration()
    runIdentityReset()
    // Осознанный выход — не «истекла»: сообщать человеку, что его выкинуло, когда он сам
    // нажал «выйти», значит врать.
    set({
      status: 'anonymous',
      user: null,
      sessionExpired: false,
      sessionExpiredMessage: null,
    })
    if (!refreshToken) return
    try {
      await requestLogout(refreshToken)
    } catch {
      // см. выше
    }
  },

  handleSessionExpired: (message) => {
    clearSession()
    // Сессия мертва — поздние ответы по ней не нужны. Кэши НЕ чистим: вход
    // того же пользователя не обязан терять вкладки (§10 п.6); смену
    // пользователя поймает notifySignedIn при следующем входе.
    bumpAuthGeneration()
    set({
      status: 'anonymous',
      user: null,
      sessionExpired: true,
      sessionExpiredMessage: message ?? null,
    })
  },
}))
