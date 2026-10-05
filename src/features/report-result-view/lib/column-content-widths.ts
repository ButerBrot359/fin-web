import type {
  ReportColumnDto,
  ReportRowDto,
} from '@/pages/reports/report-list/types/report'

import {
  decimalsOfFormat,
  formatMoney1C,
  isHighlightRow,
  isNumericCell,
  safeString,
  toNum,
} from './cell-helpers'

const DIGIT_CHAR_PX = 6.5
const HIGHLIGHT_DIGIT_CHAR_PX = 8.5
const TEXT_CHAR_PX = 7.5
const HIGHLIGHT_TEXT_CHAR_PX = 9.5
const HEAD_CHAR_PX = 9.5
const CELL_CHROME_PX = 14
const TEXT_MAX_CHARS = 30
const HEAD_WORD_MAX_CHARS = 20

const numberTextLength = (value: unknown, col: ReportColumnDto): number => {
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

const plainTextLength = (value: unknown): number => {
  const items = Array.isArray(value) ? value : [value]
  return items.reduce<number>(
    (longest, item) =>
      Math.max(
        longest,
        ...safeString(item)
          .split('\n')
          .map((line) => line.length)
      ),
    0
  )
}

const headWordLength = (col: ReportColumnDto, title: string): number =>
  col.verticalTitle
    ? 0
    : Math.min(
        HEAD_WORD_MAX_CHARS,
        Math.max(0, ...title.split(/\s+/).map((word) => word.length))
      )

export const headWordWidths = (
  columns: ReportColumnDto[],
  titleOf: (col: ReportColumnDto) => string
): number[] =>
  columns.map((col) => {
    const chars = headWordLength(col, titleOf(col))
    return chars > 0 ? Math.ceil(chars * HEAD_CHAR_PX) + CELL_CHROME_PX : 0
  })

export const columnContentWidths = (
  columns: ReportColumnDto[],
  rows: ReportRowDto[],
  headWidths: number[]
): number[] =>
  columns.map((col, i) => {
    const numeric = isNumericCell(col)
    return rows.reduce((widest, row) => {
      const value = row.cells[col.code]
      const chars = numeric
        ? numberTextLength(value, col)
        : Math.min(TEXT_MAX_CHARS, plainTextLength(value))
      if (chars === 0) return widest
      const highlight = isHighlightRow(row.rowKind)
      const charPx = numeric
        ? highlight
          ? HIGHLIGHT_DIGIT_CHAR_PX
          : DIGIT_CHAR_PX
        : highlight
          ? HIGHLIGHT_TEXT_CHAR_PX
          : TEXT_CHAR_PX
      return Math.max(widest, Math.ceil(chars * charPx) + CELL_CHROME_PX)
    }, headWidths[i] ?? 0)
  })
