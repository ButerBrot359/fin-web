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

/** Строки-итоги/обороты/сальдо ⇒ значения денежных ячеек жирные. */
const BOLD_ROW_KINDS = new Set<RowKind>([
  'CLOSING_BALANCE',
  'TOTAL',
  'SUBTOTAL',
  'TURNOVER',
])

/** Денежные ячейки этой строки рендерим жирным. */
export const isBoldMoneyRow = (rowKind?: RowKind): boolean =>
  rowKind != null && BOLD_ROW_KINDS.has(rowKind)

/** Span-строки LEDGER: подпись растягивается на первые колонки, дальше значения. */
const SPAN_ROW_KINDS = new Set<RowKind>([
  'OPENING_BALANCE',
  'TURNOVER',
  'CLOSING_BALANCE',
  'SUBTOTAL',
  'TOTAL',
])

/** Является ли строка span-строкой (подпись + значения) в режиме LEDGER. */
export const isSpanRow = (rowKind?: RowKind): boolean =>
  rowKind != null && SPAN_ROW_KINDS.has(rowKind)

/** Сальдо «на конец» / «Итого» — самые жирные span-строки. */
export const isStrongSpanRow = (rowKind?: RowKind): boolean =>
  rowKind === 'CLOSING_BALANCE' || rowKind === 'TOTAL'

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
