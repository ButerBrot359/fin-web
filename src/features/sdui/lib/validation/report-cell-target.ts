import { useMemo } from 'react'

import {
  useValidationReportStore,
  type ValidationReport,
} from '@/entities/validation-report'

/**
 * binding синтетического узла сетки регламентированного отчёта
 * (report-sheet/v1, бэк: ReportSheetWireCodes.BINDING). У цели REPORT_CELL
 * tableCode нет — сообщение ведёт к узлу по этому binding, а ячейка внутри
 * находится по адресу {pokazatelId, indeks}.
 */
export const REPORT_SHEET_BINDING = 'ReportSheet'

/** DOM-атрибут ячейки сетки: значение — reportCellKey(pokazatelId, indeks). */
export const REPORT_CELL_ATTR = 'data-sdui-report-cell'

export const reportCellKey = (pokazatelId: number, indeks: number): string =>
  `${String(pokazatelId)}:${String(indeks)}`

const EMPTY: ReadonlySet<string> = new Set<string>()

/** Ключи ячеек сетки, на которые указывают сообщения отчёта о проверке. */
export function reportCellErrorKeys(
  report: ValidationReport | undefined
): ReadonlySet<string> {
  if (!report) return EMPTY
  const keys = new Set<string>()
  for (const m of report.messages) {
    const t = m.target
    if (t?.kind === 'REPORT_CELL')
      keys.add(reportCellKey(t.pokazatelId, t.indeks))
  }
  return keys.size > 0 ? keys : EMPTY
}

/** Ячейки сетки с ошибками в текущем отчёте экрана (аналог row-errors ТЧ). */
export function useReportCellErrorKeys(): ReadonlySet<string> {
  const report = useValidationReportStore((s) =>
    s.screenKey != null ? s.reports[s.screenKey] : undefined
  )
  return useMemo(() => reportCellErrorKeys(report), [report])
}
