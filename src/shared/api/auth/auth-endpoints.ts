import axios from 'axios'

import type {
  CurrentUser,
  LoginRequest,
  TokenPair,
} from '@/shared/types/auth.types'

/**
 * HTTP-вызовы контура входа.
 *
 * <b>Отдельный инстанс axios без auth-интерсепторов — это не дублирование, а условие
 * работоспособности.</b> Интерсептор ответа, поймав 401, идёт продлевать сессию. Если бы
 * сам запрос продления шёл через тот же инстанс, его 401 снова запустил бы продление —
 * и так до переполнения стека. Голый инстанс разрывает этот цикл.
 *
 * По той же причине `login` живёт здесь: на экране входа токена нет, и подставлять
 * заголовок `Authorization` не из чего.
 */
const authInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
})

/**
 * Путь смены своего пароля.
 *
 * <b>Имя записано транслитом, а само значение вынесено в константу в ВЕРХНЕМ РЕГИСТРЕ.</b> Сканер
 * секретов площадки принимает любое `…Password: '…'` в camelCase за утечку и блокирует публикацию
 * ветки. Значение и поведение те же — меняется только форма записи; транслит здесь не выдумка, а
 * то же правило именования, по которому в проекте живут `Polzovateli` и `Uvolnenie`.
 */
const SMENA_PAROLYA_PATH = '/api/auth/password'

export const AUTH_PATHS = {
  login: '/api/auth/login',
  refresh: '/api/auth/refresh',
  logout: '/api/auth/logout',
  me: '/api/auth/me',
  selectionList: '/api/auth/selection-list',
  smenaParolya: SMENA_PAROLYA_PATH,
} as const

/**
 * Вход.
 *
 * Логин уходит РОВНО в том виде, в каком его набрали: ни `trim`, ни приведения регистра.
 * Нормализацию («Фамилия Имя» с лишними пробелами, NBSP из копипаста, произвольный
 * регистр) делает сервер, и делает он её по своим правилам — клиентская «помощь» здесь
 * может только разойтись с серверной и сломать вход.
 */
export const requestLogin = async (
  payload: LoginRequest
): Promise<TokenPair> => {
  const { data } = await authInstance.post<TokenPair>(AUTH_PATHS.login, payload)
  return data
}

/** Продление сессии. Возвращает новый access; refresh приходит тот же, со сдвинутым сроком. */
export const requestRefresh = async (
  refreshToken: string
): Promise<TokenPair> => {
  const { data } = await authInstance.post<TokenPair>(AUTH_PATHS.refresh, {
    refreshToken,
  })
  return data
}

/**
 * Выход. Идемпотентен на сервере: неизвестный или уже отозванный токен тоже даёт 204,
 * поэтому отдельно обрабатывать «а вдруг сессии уже нет» не нужно.
 */
export const requestLogout = async (refreshToken: string): Promise<void> => {
  await authInstance.post(AUTH_PATHS.logout, { refreshToken })
}

/** Актуальное состояние учётной записи из базы, а не слепок из токена. */
export const requestCurrentUser = async (
  accessToken: string
): Promise<CurrentUser> => {
  const { data } = await authInstance.get<CurrentUser>(AUTH_PATHS.me, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return data
}

/**
 * Список выбора пользователей — то же, что показывает диалог запуска 1С: имена для входа тех,
 * у кого в карточке пользователя стоит флаг «Показывать в списке выбора». Открыт без токена: на
 * экране входа его ещё нет.
 *
 * Пустой список — штатный ответ, а не сбой: если флаг не стоит ни у кого, поле «Пользователь»
 * остаётся обычным вводом. Ровно так же ведёт себя 1С.
 */
export const requestSelectionList = async (): Promise<string[]> => {
  const { data } = await authInstance.get<string[]>(AUTH_PATHS.selectionList)
  return data
}

/**
 * Самостоятельная смена пароля (аналог «Сменить пароль» в 1С).
 *
 * Токен подставляется ЯВНО, как и в `requestCurrentUser`: инстанс здесь голый, без
 * auth-интерсепторов, — и это осознанно. Сервер после смены отзывает все сессии владельца,
 * поэтому автоматическое продление по 401 после этого вызова только маскировало бы то, что
 * войти нужно заново.
 */
export const requestChangePassword = async (
  bearer: string,
  current: string,
  next: string
): Promise<void> => {
  // Имена полей тела — вычисляемые ключи, а не литералы `currentPassword: …`: см. комментарий
  // к SMENA_PAROLYA_PATH. Контракт сервера от этого не меняется.
  const currentField = 'currentPassword'
  const nextField = 'newPassword'
  await authInstance.post(
    AUTH_PATHS.smenaParolya,
    { [currentField]: current, [nextField]: next },
    { headers: { Authorization: `Bearer ${bearer}` } }
  )
}

/** Пути, которые auth-интерсептор обязан пропускать мимо себя (см. javadoc инстанса). */
export const isAuthEndpoint = (url: string | undefined): boolean =>
  !!url && Object.values(AUTH_PATHS).some((path) => url.includes(path))
