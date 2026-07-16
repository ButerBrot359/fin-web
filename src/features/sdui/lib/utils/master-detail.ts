import type { TableRow } from '../hooks/use-table-sync'
import { normalizeKey } from './cell-value'

export function findSelectedMasterRow(
  masterRows: TableRow[] | undefined,
  selectedMasterRowId: string | undefined,
): TableRow | undefined {
  if (!selectedMasterRowId || !masterRows) return undefined
  return masterRows.find((r) => r.rowId === selectedMasterRowId)
}

export function filterDetailRows(
  rows: TableRow[],
  selectedMasterRow: TableRow | undefined,
  masterKey: string,
  detailKey: string,
): TableRow[] {
  if (!selectedMasterRow) return rows
  const masterKeyValue = normalizeKey(selectedMasterRow[masterKey])
  return rows.filter((row) => normalizeKey(row[detailKey]) === masterKeyValue)
}
