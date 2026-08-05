import type { TableRow } from '../hooks/use-table-sync'
import { normalizeKey } from './cell-value'

export function findSelectedMasterRow(
  masterRows: TableRow[] | undefined,
  selectedMasterRowId: string | undefined
): TableRow | undefined {
  if (!selectedMasterRowId || !masterRows) return undefined
  return masterRows.find((r) => r.rowId === selectedMasterRowId)
}

/**
 * Подпись содержимого строки — суррогат ответа на вопрос «это всё ещё та же
 * запись?» там, где `rowId` не устойчив.
 *
 * У части типов документов (ИПН и другие, где строки ТЧ собирает хендлер)
 * `rowId` — порядковый номер строки, и при пересборке ТЧ строки
 * перенумеровываются: номер остаётся, запись за ним меняется. Устойчивого
 * идентификатора строки в контракте пока нет, поэтому «та же запись»
 * приходится приравнивать к «то же содержимое».
 *
 * Ключи сортируются: порядок полей у канона с сервера и у локальной копии
 * (`{ ...row, [binding]: value }`) может отличаться, а подмены записи это не
 * означает. Ссылочные ячейки сводятся к `id` (переиспользуем существующую
 * `normalizeKey` из этого же файла — тот же приём, что уже используется
 * `filterDetailRows` для сравнения ключей master/detail) — `presentation`
 * меняется вместе с языком формы, запись при этом та же.
 */
export function rowContentSignature(row: TableRow): string {
  return JSON.stringify(
    Object.keys(row)
      .filter((key) => key !== 'rowId')
      .sort()
      .map((key) => [key, normalizeKey(row[key]) ?? null])
  )
}

export function filterDetailRows(
  rows: TableRow[],
  selectedMasterRow: TableRow | undefined,
  masterKey: string,
  detailKey: string
): TableRow[] {
  if (!selectedMasterRow) return rows
  const masterKeyValue = normalizeKey(selectedMasterRow[masterKey])
  return rows.filter((row) => normalizeKey(row[detailKey]) === masterKeyValue)
}
