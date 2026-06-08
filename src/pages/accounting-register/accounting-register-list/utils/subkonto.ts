import type { AccountingRegisterEntry } from '../types/accounting-register'

/**
 * Достаёт отображаемое значение субконто из массивов записи
 * `subkontosDt` / `subkontosKt` (по позиции 1..3 и стороне Дт/Кт).
 *
 * Элемент массива — уже разрезолвленный справочный объект; берём его
 * `displayName` → `nameRu` → `code`. Форма элемента бэка точно не
 * зафиксирована, поэтому читаем поля терпимо.
 */
export const getSubkontoValue = (
  row: AccountingRegisterEntry,
  position: number,
  side: 'Dt' | 'Kt'
): string | null => {
  const arr = row[side === 'Dt' ? 'subkontosDt' : 'subkontosKt']
  if (!Array.isArray(arr)) return null

  const item = arr.find((s) => {
    if (!s || typeof s !== 'object') return false
    const pos = (s as Record<string, unknown>).position
    return pos === position
  }) as Record<string, unknown> | undefined
  if (!item) return null

  // Значение субконто может лежать как вложенный объект (item.value) либо
  // прямо в элементе.
  const value =
    item.value && typeof item.value === 'object'
      ? (item.value as Record<string, unknown>)
      : item

  const label =
    (value.displayName as string | undefined) ??
    (value.nameRu as string | undefined) ??
    (value.name as string | undefined) ??
    (value.code as string | undefined)

  return label ?? null
}
