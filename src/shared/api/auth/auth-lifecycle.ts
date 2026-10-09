/**
 * Точки жизненного цикла личности (SCRUM-400 §10). Реализацию подключает
 * app-слой (`useAuthLifecycleBinding`): shared не знает ни про SDUI-сессии,
 * ни про QueryClient — прямые импорты запрещены направлением зависимостей FSD.
 */

type BeforeSignOutHook = () => Promise<void> | void
type IdentityResetHook = () => void
type SignedInHook = () => void

let beforeSignOut: BeforeSignOutHook | null = null
let identityReset: IdentityResetHook | null = null
let signedIn: SignedInHook | null = null

/** Пользователь, под которым работала эта вкладка последним. */
let lastUserId: number | null = null

export const setAuthLifecycleHooks = (hooks: {
  onBeforeSignOut: BeforeSignOutHook
  onIdentityReset: IdentityResetHook
  /** Любой успешный вход (и того же пользователя): снять пост-выходные флаги. */
  onSignedIn?: SignedInHook
}): void => {
  beforeSignOut = hooks.onBeforeSignOut
  identityReset = hooks.onIdentityReset
  signedIn = hooks.onSignedIn ?? null
}

/** Потолок ожидания CLOSE сессий: выход не должен зависать из-за сети. */
const BEFORE_SIGN_OUT_CAP_MS = 3_000

/**
 * Перед выходом: закрыть SDUI-сессии, ПОКА токен ещё есть (после очистки
 * CLOSE ответил бы 401). Ограничено по времени и не бросает: выход обязан
 * состояться даже при лежащем бэке.
 */
export const runBeforeSignOut = async (): Promise<void> => {
  if (!beforeSignOut) return
  try {
    await Promise.race([
      Promise.resolve(beforeSignOut()),
      new Promise<void>((resolve) =>
        setTimeout(resolve, BEFORE_SIGN_OUT_CAP_MS)
      ),
    ])
  } catch {
    // Закрытие сессий — best effort; несработавшее умрёт по TTL на сервере.
  }
}

export const runIdentityReset = (): void => {
  lastUserId = null
  try {
    identityReset?.()
  } catch {
    // Сброс кэшей не должен уронить вход/выход.
  }
}

/**
 * Восстановление сессии из localStorage при старте вкладки: кэши не трогаются,
 * но «кто работал последним» обязан быть посеян — иначе смена пользователя
 * после истечения восстановленной сессии не распознаётся (lastUserId остался
 * бы null, и вошедший B увидел бы кэши A).
 */
export const seedLastUserId = (userId: number): void => {
  lastUserId = userId
}

/**
 * Успешный вход. Кэши сбрасываются только при СМЕНЕ пользователя: вход того же
 * человека после истечения сессии не обязан терять состояние вкладок (§10 п.6).
 */
export const notifySignedIn = (userId: number): void => {
  const changed = lastUserId !== null && lastUserId !== userId
  // Единственная реализация сброса — runIdentityReset (она обнуляет
  // lastUserId, поэтому новый пользователь записывается ПОСЛЕ).
  if (changed) runIdentityReset()
  lastUserId = userId
  try {
    signedIn?.()
  } catch {
    // вход не должен падать из-за подписчика
  }
}
