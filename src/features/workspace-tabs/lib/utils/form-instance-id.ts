/**
 * Идентификатор ЭКЗЕМПЛЯРА формы рабочей вкладки — то, что уходит на бэк в
 * `action.formInstanceId` на каждом OPEN.
 *
 * <p>Сервер по нему отличает «вернулся в свою форму» от «создаю новый документ»: на проводе
 * оба запроса — OPEN одного маршрута `/documents/<Type>/new`, и без идентификатора черновик
 * незаписанного документа всплывал бы в новой форме создания (бэк: DocumentFormDraftStore).
 *
 * <p><b>Резервирование.</b> Идентификатор нужен УЖЕ на первом OPEN, а вкладка рабочего стола
 * создаётся позже — из ответа того же OPEN (метаданные вкладки приходят только там). Поэтому
 * идентификатор сначала резервируется по маршруту, а созданная вкладка его забирает: сессия
 * и вкладка получают ОДИН идентификатор, и черновик первой же формы уже зеркалится.
 */
const reserved = new Map<string, string>()

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

export function newFormInstanceId(): string {
  return generate()
}

/** Зарезервировать (или вернуть уже зарезервированный) идентификатор для маршрута. */
export function reserveFormInstanceId(path: string): string {
  const existing = reserved.get(path)
  if (existing) return existing
  const id = generate()
  reserved.set(path, id)
  return id
}

/** Забрать резерв — вызывает вкладка при создании, чтобы взять ТОТ ЖЕ идентификатор. */
export function claimFormInstanceId(path: string): string {
  const id = reserveFormInstanceId(path)
  reserved.delete(path)
  return id
}

/** Снять резерв: следующий OPEN этого маршрута начнёт новый экземпляр формы. */
export function clearFormInstanceReservation(path: string): void {
  reserved.delete(path)
}
