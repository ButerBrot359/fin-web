import type {
  ReportColumnDto,
  ReportRowDto,
} from '@/pages/reports/report-list/types/report'

import {
  decimalsOfFormat,
  formatMoney1C,
  isHighlightRow,
  isNumericCell,
  toNum,
} from './cell-helpers'

const DATA_CHAR_PX = 6.5
const HIGHLIGHT_CHAR_PX = 8
const CELL_CHROME_PX = 14

const cellTextLength = (value: unknown, col: ReportColumnDto): number => {
  const items = Array.isArray(value) ? value : [value]
  const decimals = Array.isArray(value) ? 3 : decimalsOfFormat(col.format).max
  return items.reduce<number>((longest, item) => {
    const n = toNum(item)
    if (n == null || (n === 0 && col.blankOnZero)) return longest
    const text = col.dcIndicator
      ? `Д ${formatMoney1C(Math.abs(n), decimals)}`
      : formatMoney1C(n, decimals)
    return Math.max(longest, text.length)
  }, 0)
}

export const numericContentWidths = (
  columns: ReportColumnDto[],
  rows: ReportRowDto[]
): number[] =>
  columns.map((col) => {
    if (!isNumericCell(col)) return 0
    return rows.reduce((widest, row) => {
      const chars = cellTextLength(row.cells[col.code], col)
      if (chars === 0) return widest
      const charPx = isHighlightRow(row.rowKind)
        ? HIGHLIGHT_CHAR_PX
        : DATA_CHAR_PX
      return Math.max(widest, Math.ceil(chars * charPx) + CELL_CHROME_PX)
    }, 0)
  })
