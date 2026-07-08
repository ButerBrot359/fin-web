import type {
  ReportColumnDto,
  ReportRowDto,
  RowKind,
} from '@/pages/reports/report-list/types/report'

/** MEASURE — числовая колонка (выравнивание вправо, разрядность). */
export const isMeasure = (col: ReportColumnDto): boolean =>
  col.role === 'MEASURE'

/** Эффективное выравнивание ячейки: явный `align` ∥ по роли (MEASURE ⇒ right). */
export const isRightAligned = (col: ReportColumnDto): boolean => {
  if (col.align) return col.align === 'RIGHT'
  return isMeasure(col)
}

/**
 * Цвет 1С для групп, итогов и шапки колонок — тёмно-зелёный из живого
 * табличного документа 1С (rgb(0,63,47)); заливок 1С не использует.
 */
export const GREEN_1C = 'rgb(0,63,47)'

/**
 * Кегли 1С из живого табличного документа: данные ~11px, шапка колонок и
 * строки-итоги/группы ~13px (bold). Держим отчёт таким же плотным, как 1С.
 */
export const DATA_FS = 11
export const HEAD_FS = 13

/** Строки-итоги/обороты/сальдо/группы ⇒ вся строка жирная тёмно-зелёная (1С). */
const HIGHLIGHT_ROW_KINDS = new Set<RowKind>([
  'GROUP_HEADER',
  'OPENING_BALANCE',
  'CLOSING_BALANCE',
  'TOTAL',
  'SUBTOTAL',
  'TURNOVER',
])

/** Строка выделяется 1С-стилем (bold + зелёный), включая текстовые ячейки. */
export const isHighlightRow = (rowKind?: RowKind): boolean =>
  rowKind != null && HIGHLIGHT_ROW_KINDS.has(rowKind)

/**
 * Является ли строка span-строкой (подпись labelText на первые колонки,
 * дальше значения). Строки-итоги БЕЗ labelText (напр. «Начальное сальдо»
 * текстом в ячейке Кор.Счета в Анализе счёта) рендерятся как обычные,
 * но с 1С-выделением.
 */
export const isSpanRow = (row: {
  rowKind?: RowKind
  labelText?: string
}): boolean => isHighlightRow(row.rowKind) && row.labelText != null

/** Сальдо «на конец» / «Итого» — самые жирные span-строки. */
export const isStrongSpanRow = (rowKind?: RowKind): boolean =>
  rowKind === 'CLOSING_BALANCE' || rowKind === 'TOTAL'

/**
 * Денежный формат 1С: всегда фиксированное число десятичных знаков (2 для
 * сумм, 3 для количества), разряды пробелами, десятичный разделитель —
 * запятая («1 350 000,00»).
 */
export const formatMoney1C = (value: number, decimals = 2): string => {
  const negative = value < 0
  const [intPart, decPart] = Math.abs(value).toFixed(decimals).split('.')
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return (negative ? '-' : '') + formattedInt + (decPart ? `,${decPart}` : '')
}

/** Безопасное приведение значения ячейки к числу (или null). */
export const toNum = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isNaN(n) ? null : n
}

/** Безопасное строковое представление скаляра (без `[object Object]`). */
export const safeString = (v: unknown): string => {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return ''
}

/** Значение ячейки строки по коду колонки. */
export const cellValue = (row: ReportRowDto, code: string): unknown =>
  row.cells[code]
