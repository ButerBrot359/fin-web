import type { CurrentUser } from '@/shared/types/auth.types'

/**
 * Хранилище токенов и логина последнего входа.
 *
 * <b>Почему localStorage, а не память.</b> Перезагрузка вкладки не должна разлогинивать:
 * иначе F5 посреди работы выкидывает на экран входа. Вариант с httpOnly-cookie здесь
 * невозможен — бэкенд отдаёт токены телом ответа (контракт `POST /api/auth/login`), а не
 * ставит cookie. Плата известна: токены доступны JS, то есть XSS равносилен угону сессии;
 * компенсируется коротким сроком access-токена (минуты) и отзываемым refresh на сервере.
 *
 * <b>Каждый доступ обёрнут в try/catch.</b> В приватном окне, при отключённых site data и
 * в части встроенных браузеров `localStorage` бросает при первом же обращении. Падать из-за
 * этого нельзя: приложение обязано открыться, просто вход не переживёт перезагрузку.
 */

const ACCESS_TOKEN_KEY = 'webbuh.auth.accessToken'
const REFRESH_TOKEN_KEY = 'webbuh.auth.refreshToken'
const USER_KEY = 'webbuh.auth.user'

/**
 * Логин последнего УСПЕШНОГО входа на этом устройстве — им предзаполняется поле на экране
 * входа (ТЗ «Аутентификация» §А1).
 *
 * Ключ намеренно отдельный от токенов и НЕ стирается при выходе: смысл в том, чтобы
 * человек, вышедший вчера, не набирал «Фамилия Имя» заново. Серверного эндпоинта «кто
 * заходил последним» не существует и быть не должно — он раскрыл бы действующую учётную
 * запись любому, кто открыл страницу входа. Знает логин только тот браузер, из которого
 * этот вход был совершён.
 */
const LAST_LOGIN_KEY = 'webbuh.auth.lastLogin'

/**
 * Логины, под которыми на ЭТОМ устройстве уже входили, — список для выпадашки поля
 * «Пользователь» на экране входа.
 *
 * <b>Это не список пользователей системы.</b> В макете у поля есть стрелка выбора, но
 * серверного перечня учётных записей не существует и появиться не должно (ТЗ §А1): он
 * раскрыл бы, кто заведён в базе, любому, кто открыл страницу входа. Здесь же браузер
 * помнит ровно то, что и так знает, — логины, набранные на нём самом. Общая машина
 * покажет тех, кто на ней работал, и никого больше.
 */
const KNOWN_LOGINS_KEY = 'webbuh.auth.knownLogins'

/** Больше пяти в выпадашке бесполезно, а список растёт с каждым входом. */
const KNOWN_LOGINS_LIMIT = 5

const read = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

const write = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Хранилище недоступно — работаем без запоминания. Не диагноз для пользователя.
  }
}

const remove = (key: string): void => {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // см. write
  }
}

export const getAccessToken = (): string | null => read(ACCESS_TOKEN_KEY)

export const getRefreshToken = (): string | null => read(REFRESH_TOKEN_KEY)

export const getStoredUser = (): CurrentUser | null => {
  const raw = read(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as CurrentUser
  } catch {
    // Мусор в хранилище (ручная правка, смена формата между релизами) — не повод падать
    // на старте приложения. Считаем, что пользователя нет; /api/auth/me всё равно
    // перечитает актуальное состояние.
    remove(USER_KEY)
    return null
  }
}

export const saveSession = (
  accessToken: string,
  refreshToken: string,
  user: CurrentUser
): void => {
  write(ACCESS_TOKEN_KEY, accessToken)
  write(REFRESH_TOKEN_KEY, refreshToken)
  write(USER_KEY, JSON.stringify(user))
}

/** Продление сессии: refresh-токен переиспользуется, меняются только access и пользователь. */
export const saveRefreshedSession = (
  accessToken: string,
  refreshToken: string,
  user: CurrentUser
): void => {
  saveSession(accessToken, refreshToken, user)
}

/** Логин последнего входа стирать НЕЛЬЗЯ — см. LAST_LOGIN_KEY. */
export const clearSession = (): void => {
  remove(ACCESS_TOKEN_KEY)
  remove(REFRESH_TOKEN_KEY)
  remove(USER_KEY)
}

export const getLastLogin = (): string => read(LAST_LOGIN_KEY) ?? ''

export const getKnownLogins = (): string[] => {
  const raw = read(KNOWN_LOGINS_KEY)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    remove(KNOWN_LOGINS_KEY)
    return []
  }
}

/**
 * Запоминает логин последнего входа и добавляет его в список известных этому устройству.
 * Совпадения ищутся без учёта регистра и краевых пробелов — иначе «Иванов Иван» и
 * «иванов иван » осели бы в списке двумя строками, хотя это один человек.
 */
export const saveLastLogin = (login: string): void => {
  write(LAST_LOGIN_KEY, login)

  const normalized = login.trim().toLowerCase()
  const rest = getKnownLogins().filter(
    (known) => known.trim().toLowerCase() !== normalized
  )
  write(
    KNOWN_LOGINS_KEY,
    JSON.stringify([login, ...rest].slice(0, KNOWN_LOGINS_LIMIT))
  )
}

/** «Войти под другим пользователем» — очищает предзаполнение логина. */
export const clearLastLogin = (): void => {
  remove(LAST_LOGIN_KEY)
}
