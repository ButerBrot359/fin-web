import type { TableRow as SyncRow } from '../../../lib/hooks/use-table-sync'

export const replaceDayRows = (
  allRows: SyncRow[],
  dayNumber: number,
  dayRows: SyncRow[]
): SyncRow[] => {
  const firstDayIndex = allRows.findIndex((row) => row.NomerDnya === dayNumber)
  const nextDayRows = dayRows.map((row) => ({
    ...row,
    NomerDnya: dayNumber,
  }))
  if (firstDayIndex < 0) return [...allRows, ...nextDayRows]

  const next: SyncRow[] = []
  let inserted = false
  for (const row of allRows) {
    if (row.NomerDnya !== dayNumber) {
      next.push(row)
      continue
    }
    if (!inserted) {
      next.push(...nextDayRows)
      inserted = true
    }
  }
  return next
}
