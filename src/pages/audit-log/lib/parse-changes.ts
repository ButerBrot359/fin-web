/** Изменение одного реквизита: «было → стало». */
export interface AttributeChange {
  field: string
  before: string | null
  after: string | null
}

const toText = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value as string | number | boolean)
}

/**
 * Разбирает поле `changes` записи журнала: JSON вида `{"Код": {"before": …, "after": …}}`.
 * Пусто (CREATE, события сеанса) или битый JSON — пустой список: карточка события покажет
 * «изменений нет», а не упадёт.
 */
export const parseChanges = (
  raw: string | null | undefined
): AttributeChange[] => {
  if (!raw?.trim()) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return []
    return Object.entries(parsed as Record<string, unknown>)
      .filter(
        (entry): entry is [string, Record<string, unknown>] =>
          !!entry[1] && typeof entry[1] === 'object'
      )
      .map(([field, change]) => ({
        field,
        before: toText(change.before),
        after: toText(change.after),
      }))
  } catch {
    return []
  }
}
