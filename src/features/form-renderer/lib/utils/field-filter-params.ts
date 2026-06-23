import type { FieldFilter } from '@/entities/form-config'

/**
 * Превращает серверный фильтр ссылочного поля в query-параметры пикера.
 * `attributeEquals: { Organizatsiya: 30294 }` → `{ Organizatsiya: '30294' }`.
 * Возвращает `undefined`, если фильтра/значений нет (запрос без отбора).
 */
export const fieldFilterToSearchParams = (
  filter: FieldFilter | undefined
): Record<string, string> | undefined => {
  const equals = filter?.attributeEquals
  if (!equals) return undefined
  const entries = Object.entries(equals)
  if (entries.length === 0) return undefined
  return Object.fromEntries(entries.map(([key, value]) => [key, String(value)]))
}
