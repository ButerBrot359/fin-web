/**
 * Идентификатор ЭКЗЕМПЛЯРА формы рабочей вкладки — то, что уходит на бэк в
 * `action.formInstanceId` на каждом OPEN (фронт-спека 03.09.2026 §5.1).
 *
 * <p>Сервер по нему отличает «вернулся в свою форму» от «создаю новый документ»: на проводе
 * оба запроса — OPEN одного маршрута `/documents/<Type>/new`, и без идентификатора черновик
 * незаписанного документа всплывал бы в новой форме создания (бэк: DocumentFormDraftStore).
 *
 * <p><b>Только в памяти.</b> Ни в localStorage, ни в persisted-сторе вкладок: иначе ДВЕ вкладки
 * браузера получили бы один идентификатор и видели черновики друг друга (спека §5.1, приёмка
 * п.5). Ценой служит F5 — после перезагрузки идентификатор новый и черновик незаписанной формы
 * недостижим; это дешевле, чем чужие данные в форме.
 *
 * <p>Ключ — путь маршрута: рабочая вкладка адресуется им же (id вкладки = path).
 */
const ids = new Map<string, string>()

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
  ids.set(path, id)
  return id
}

/** Начать НОВЫЙ экземпляр формы на этом маршруте («Создать», копия, ввод на основании). */
export function rotateFormInstanceId(path: string): string {
  const id = generate()
  ids.set(path, id)
  return id
}

/** Вкладку закрыли — следующее открытие того же маршрута начнёт новый экземпляр (§5.1). */
export function forgetFormInstanceId(path: string): void {
  ids.delete(path)
}
