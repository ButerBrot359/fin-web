import type {
  AnalyticsColumn,
  AnalyticsQueryColumn,
  AnalyticsValueFormat,
} from '@/entities/analytics'
import type { TableExportData } from '@/shared/lib/table-export'
import type { XlsxCell, XlsxColumnMeta } from '@/shared/lib/xlsx/write-xlsx'

import { formatValue, pickLabel, toFiniteNumber } from './format-value'

const NUMERIC_FORMATS: AnalyticsValueFormat[] = [
  'MONEY',
  'INTEGER',
  'DECIMAL2',
  'PERCENT',
]

const isNumeric = (format?: AnalyticsValueFormat | null): boolean =>
  format != null && NUMERIC_FORMATS.includes(format)

const columnMeta = (format?: AnalyticsValueFormat | null): XlsxColumnMeta => {
  if (format === 'MONEY' || format === 'DECIMAL2' || format === 'PERCENT') {
    return { numFmt: 'money' }
  }
  if (format === 'INTEGER') return {}
  return { align: 'left' }
}

/**
 * Числа отдаём числами — Excel применит к ним формат разрядов и позволит
 * считать по колонке; всё остальное форматируем так же, как на экране.
 */
const toCell = (
  value: unknown,
  format?: AnalyticsValueFormat | null
): XlsxCell => {
  if (value == null) return ''
  if (isNumeric(format)) return toFiniteNumber(value) ?? ''
  return formatValue(value, format)
}

/**
 * Данные листа Excel для `exportTableToXlsx` из `@/shared/lib/table-export`.
 *
 * `columns` задаёт порядок значений в строках результата, `specColumns` —
 * заголовки и форматы из спецификации (сопоставление по имени колонки).
 */
export const buildExportData = (
  columns: AnalyticsQueryColumn[],
  rows: unknown[][],
  specColumns?: AnalyticsColumn[],
  title?: string,
  lang?: string | null
): TableExportData => {
  const spec = new Map((specColumns ?? []).map((c) => [c.name, c]))
  const formats = columns.map((column) => spec.get(column.name)?.format ?? null)

  return {
    headers: columns.map((column) =>
      pickLabel(spec.get(column.name), column.name, lang)
    ),
    rows: rows.map((row) =>
      columns.map((_, index) => toCell(row[index], formats[index]))
    ),
    title,
    columns: formats.map(columnMeta),
  }
}
