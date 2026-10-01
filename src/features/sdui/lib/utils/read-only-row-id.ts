/**
 * Идентификатор строки read-only таблицы для построчных команд.
 *
 * Строки ТЧ по контракту ADR-0022 несут `rowId`; push-модель экранов-обработок
 * (композеры конструктора отчётности, `OtchetnostNodeSupport.table`) кладёт в
 * state строки с ключом `id`. Сервер читает выбор из `value.rowId` (с запасным
 * `value.id` — `OtchetnostCommandContext.selectedRowId`), поэтому фронт шлёт
 * `{rowId: <rowId ?? id>}` — то же значение, что лежит в строке. null — у строки
 * нет идентичности, выбрать её для команды нельзя.
 */
export function readOnlyRowId(row: Record<string, unknown>): string | null {
  const raw = row.rowId ?? row.id
  if (typeof raw === 'string') return raw === '' ? null : raw
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw)
  return null
}
