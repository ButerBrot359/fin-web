import type { FieldFilter } from '@/entities/form-config'

/**
 * Превращает фильтр ссылочного поля в query-параметры пикера.
 *
 * Используем параметр `af` ("attribute filter") в формате `code:value` —
 * именно так универсальный эндпоинт списков/поиска
 * (`/api/universaldomain-entries/...`) фильтрует по значению атрибута
 * (тот же механизм, что у зависимостей справочников). Несколько условий
 * объединяются через запятую.
 *
 * `attributeEquals: { Organizatsiya: 30294 }` → `{ af: 'Organizatsiya:30294' }`.
 * Возвращает `undefined`, если фильтра/значений нет (запрос без отбора).
 */
export const fieldFilterToSearchParams = (
  filter: FieldFilter | undefined
): Record<string, string> | undefined => {
  const equals = filter?.attributeEquals
  if (!equals) return undefined
  const parts = Object.entries(equals).map(
    ([key, value]) => `${key}:${String(value)}`
  )
  if (parts.length === 0) return undefined
  return { af: parts.join(',') }
}

/**
 * Объединяет два набора query-параметров пикера. Параметр `af` (отбор по
 * атрибуту) склеивается через запятую, чтобы фильтр зависимости и серверный
 * фильтр поля применялись вместе, а не затирали друг друга.
 */
export const mergeSearchParams = (
  a: Record<string, string> | undefined,
  b: Record<string, string> | undefined
): Record<string, string> | undefined => {
  if (!a) return b
  if (!b) return a
  const merged = { ...a, ...b }
  if (a.af && b.af) merged.af = `${a.af},${b.af}`
  return merged
}

/**
 * Режим выбора ссылочного атрибута (1С «выбор групп и элементов»,
 * `referenceSelectionMode` в метаданных). `GROUP` — выбирать можно только
 * группы (папки): в запросы пикера добавляется `groupsOnly=true`
 * (см. backend-handoff-os-card-fields.md). Остальные режимы — без отбора.
 */
export const selectionModeToSearchParams = (
  mode: string | null | undefined
): Record<string, string> | undefined =>
  mode === 'GROUP' ? { groupsOnly: 'true' } : undefined
