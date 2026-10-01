/**
 * Идентификатор ЭКЗЕМПЛЯРА формы рабочей вкладки — то, что уходит на бэк в
 * `action.formInstanceId` на каждом OPEN (фронт-спека 03.09.2026 §5.1).
 *
 * <p>Сервер по нему отличает «вернулся в свою форму» от «создаю новый документ»: на проводе
 * оба запроса — OPEN одного маршрута `/documents/<Type>/new`, и без идентификатора черновик
 * незаписанного документа всплывал бы в новой форме создания (бэк: DocumentFormDraftStore).
 *
 * <p><b>sessionStorage, не localStorage.</b> sessionStorage у каждой вкладки браузера свой, поэтому
 * две вкладки браузера не делят идентификатор и не видят черновики друг друга (спека §5.1,
 * приёмка п.5), а F5 сохраняет идентификатор, и черновик формы восстанавливается.
 *
 * <p>Ключ — путь маршрута: рабочая вкладка адресуется им же (id вкладки = path).
 */
const STORAGE_KEY = 'workspace-form-instance-ids'

function load(): Map<string, string> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return new Map()
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object') return new Map()
    return new Map(
      Object.entries(parsed).filter(
        (e): e is [string, string] => typeof e[1] === 'string'
      )
    )
  } catch {
    return new Map()
  }
}

const ids = load()

function persist(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(ids)))
  } catch {
    return
  }
}

function remember(path: string, id: string): void {
  ids.set(path, id)
  persist()
}

function generate(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }
  // jsdom/старые браузеры: uuid не нужен — нужна уникальность в рамках рабочего стола.
  return `fi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Идентификатор экземпляра формы для маршрута; при первом обращении заводится. */
export function formInstanceIdFor(path: string): string {
  const existing = ids.get(path)
  if (existing) return existing
  const id = generate()
  remember(path, id)
  return id
}

/** Начать НОВЫЙ экземпляр формы на этом маршруте («Создать», копия, ввод на основании). */
export function rotateFormInstanceId(path: string): string {
  const id = generate()
  remember(path, id)
  return id
}

export function adoptFormInstanceId(path: string, id: string): void {
  remember(path, id)
}

/** Reserve a fresh draft scope without abandoning the current form before OPEN succeeds. */
export function prepareFreshFormInstanceId(path: string): {
  id: string
  commit: () => boolean
} {
  const previous = ids.get(path)
  const id = generate()
  return {
    id,
    commit: () => {
      if (ids.get(path) !== previous) return false
      remember(path, id)
      return true
    },
  }
}

/** Вкладку закрыли — следующее открытие того же маршрута начнёт новый экземпляр (§5.1). */
export function forgetFormInstanceId(path: string): void {
  if (ids.delete(path)) persist()
}
