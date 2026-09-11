import { useMemo } from 'react'

import {
  useValidationReportStore,
  type ValidationReport,
} from '@/entities/validation-report'

const EMPTY: ReadonlySet<number> = new Set<number>()

export const ROW_ERROR_BACKGROUND = 'rgba(244, 72, 42, 0.12)'

export function rowErrorIndexes(
  report: ValidationReport | undefined,
  tableCode: string | null | undefined
): ReadonlySet<number> {
  if (!report || !tableCode) return EMPTY
  const indexes = new Set<number>()
  for (const m of report.messages) {
    const t = m.target
    if (t?.kind === 'TABLE_CELL' && t.tableCode === tableCode) {
      indexes.add(t.rowIndex)
    }
  }
  return indexes.size > 0 ? indexes : EMPTY
}

export function rowAddressedTableCodes(
  report: ValidationReport | null | undefined
): ReadonlySet<string> {
  const codes = new Set<string>()
  if (!report) return codes
  for (const m of report.messages) {
    const t = m.target
    if (t?.kind === 'TABLE_CELL') codes.add(t.tableCode)
  }
  return codes
}

export function useTableRowErrorIndexes(
  binding: string | null | undefined
): ReadonlySet<number> {
  const report = useValidationReportStore((s) =>
    s.screenKey != null ? s.reports[s.screenKey] : undefined
  )
  return useMemo(() => rowErrorIndexes(report, binding), [report, binding])
}
