import type {
  ReportColumnDto,
  ReportFormSectionDto,
} from '@/pages/reports/report-list/types/report'

import { formatMoney1C } from './cell-helpers'

const WRAP_MIN_CHARS = 13

export interface FitToWidthLayout {
  widths: string[]
  width: number
  minWidth: number
}

const longestMoneyChars = (
  section: ReportFormSectionDto,
  code: string
): number =>
  section.rows.reduce((mx, row) => {
    const v = row.cells[code]
    const n = typeof v === 'number' ? v : Number(v)
    return v == null || v === '' || Number.isNaN(n)
      ? mx
      : Math.max(mx, formatMoney1C(n).length)
  }, 0)

const minColumnPx = (
  col: ReportColumnDto,
  section: ReportFormSectionDto,
  charPx: number
): number => {
  const width = col.width ?? 0
  if (col.wrap) return Math.min(width, WRAP_MIN_CHARS) * charPx
  if (col.role === 'MEASURE') {
    const chars = longestMoneyChars(section, col.code)
    if (chars > 0) return Math.min(width, chars + 1) * charPx
  }
  return width * charPx
}

export const fitToWidthLayout = (
  cols: ReportColumnDto[],
  section: ReportFormSectionDto,
  charPx: number
): FitToWidthLayout | null => {
  const total = cols.reduce((sum, c) => sum + (c.width ?? 0), 0)
  if (total <= 0) return null
  const widths = cols.map((c) => `${String(((c.width ?? 0) / total) * 100)}%`)
  const minWidth = Math.ceil(
    cols.reduce((mx, c) => {
      const share = (c.width ?? 0) / total
      return share > 0
        ? Math.max(mx, minColumnPx(c, section, charPx) / share)
        : mx
    }, 0)
  )
  return { widths, width: total * charPx, minWidth }
}
