import type { TableColumnDef, TableRow } from '../hooks/use-table-sync'

/**
 * `unknown` → строка параметра или `null`, если значение не примитив.
 * Явные проверки типа вместо `String(value)`: на объекте это дало бы
 * «[object Object]» (правило no-base-to-string), а `__rowParentIds` — сырое
 * значение с бэка, тип которого статически не гарантирован.
 */
function toParamValue(value: unknown): string | null {
  if (value == null) return null
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value)
  }
  return null
}

/**
 * Параметры сужения пикера ячейки по per-row ключу `__rowParentIds` (SCRUM-332 §3).
 * `col.props.rowFilter = { <paramName>: <sourceCol> }` объявляет ИМЯ query-параметра;
 * готовое значение бэк кладёт в `row.__rowParentIds[col.binding]`. Нет rowFilter
 * или нет ключа (ОС не выбран) → `{}` (полный список, поведение прежнее).
 */
export function resolveRowFilterParams(
  col: TableColumnDef,
  row: TableRow
): Record<string, string> {
  const rowFilter = col.props.rowFilter as Record<string, string> | undefined
  if (!rowFilter) return {}
  const paramName = Object.keys(rowFilter)[0]
  if (!paramName) return {}
  const parentIds = row.__rowParentIds as Record<string, unknown> | undefined
  const value = toParamValue(parentIds?.[col.binding])
  if (value == null) return {}
  return { [paramName]: value }
}
