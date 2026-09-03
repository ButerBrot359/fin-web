/**
 * SCRUM-312: стабильный идентификатор вкладки рабочего стола для серверных
 * черновиков форм (`action.formInstanceId` на OPEN). Сервер по нему разводит
 * «я вернулась в свою форму создания» (тот же id → восстановить черновик) и
 * «я создаю новый документ» (другой/новый id → пустая форма).
 *
 * Инварианты (фронт-спека formInstanceId от 03.09):
 * - один id — одна вкладка; закрыли вкладку → id умирает (closeTab → drop);
 * - id переживает переход new → записанный (updateTabPath → move) и реопен
 *   после 409 (вкладка та же — ensure вернёт прежний id);
 * - sessionStorage: F5 сохраняет вкладки рабочего стола — и их id тоже;
 *   новая браузерная вкладка = чистый sessionStorage = новые id.
 */

const STORAGE_KEY = 'workspace-tabs.formInstanceIds'

type IdMap = Record<string, string>

const read = (): IdMap => {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as IdMap) : {}
  } catch {
    // sessionStorage недоступен (встроенные браузеры) — работаем без
    // персиста: id живёт в памяти процесса через это же чтение-фолбэк.
    return memoryFallback
  }
}

const write = (map: IdMap): void => {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    memoryFallback = map
  }
}

let memoryFallback: IdMap = {}

/** id вкладки; генерируется при первом обращении и стабилен до dropа. */
export function ensureFormInstanceId(tabId: string): string {
  const map = read()
  const existing = map[tabId]
  if (existing) return existing
  const id = crypto.randomUUID()
  write({ ...map, [tabId]: id })
  return id
}

/** Вкладка закрыта — следующий OPEN этого маршрута получит НОВЫЙ id. */
export function dropFormInstanceId(tabId: string): void {
  const map = read()
  if (!(tabId in map)) return
  const { [tabId]: _dropped, ...rest } = map
  write(rest)
}

/** Вкладка сменила маршрут (new → записанный): id едет вместе с ней. */
export function moveFormInstanceId(fromTabId: string, toTabId: string): void {
  if (fromTabId === toTabId) return
  const map = read()
  const id = map[fromTabId]
  if (!id) return
  const { [fromTabId]: _moved, ...rest } = map
  write({ ...rest, [toTabId]: id })
}
