import type { TableExportData } from '@/shared/lib/table-export'
import type {
  XlsxCell,
  XlsxColumnMeta,
  XlsxRowKind,
} from '@/shared/lib/xlsx/write-xlsx'
import { formatDate } from '@/shared/lib/utils/date'
import { formatReportTitle } from '@/features/report-result-view'

import type {
  ReportAltColumnDto,
  ReportAltResultDto,
  ReportAltRowDto,
} from '../../types/reportalt'

/** Локализованный заголовок колонки. */
const columnTitle = (col: ReportAltColumnDto, isKz: boolean): string =>
  (isKz ? col.titleKz : col.titleRu) || col.titleRu

/** Виды строк, выделяемые в выгрузке (итоги/сальдо/группы). */
const HIGHLIGHT_KINDS = new Set([
  'GROUP_HEADER',
  'OPENING_BALANCE',
  'TURNOVER',
  'CLOSING_BALANCE',
  'SUBTOTAL',
  'TOTAL',
])

const rowKindOf = (row: ReportAltRowDto): XlsxRowKind =>
  row.rowKind != null && HIGHLIGHT_KINDS.has(row.rowKind) ? 'highlight' : 'data'

/** Span-строка LEDGER (Сальдо/Обороты/Итого) с подписью labelText. */
const isSpanRow = (row: ReportAltRowDto): boolean =>
  row.rowKind != null &&
  HIGHLIGHT_KINDS.has(row.rowKind) &&
  row.rowKind !== 'GROUP_HEADER' &&
  row.labelText != null

/**
 * Значение ячейки для Excel: MEASURE — настоящее число (формат разрядов даёт
 * Excel), массив — многострочный текст, PERIOD — дата `dd.MM.yyyy`.
 */
const formatCell = (value: unknown, col: ReportAltColumnDto): XlsxCell => {
  if (value == null || value === '') return ''
  if (Array.isArray(value)) {
    return value.filter((v) => v != null && v !== '').join('\n')
  }
  if (col.role === 'MEASURE') {
    const n = typeof value === 'number' ? value : Number(value)
    if (!Number.isNaN(n)) {
      if (n === 0 && col.blankOnZero) return ''
      return n
    }
  }
  if (
    col.role === 'PERIOD' &&
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}/.test(value)
  ) {
    return formatDate(value, 'dd.MM.yyyy') || value
  }
  if (typeof value === 'string' || typeof value === 'number') return value
  return ''
}

/** Метаданные колонок листа: числовой формат и выравнивание. */
const buildColumnMeta = (
  columns: ReportAltColumnDto[],
  hasLeadColumn: boolean
): XlsxColumnMeta[] => {
  const meta: XlsxColumnMeta[] = []
  if (hasLeadColumn) meta.push({ align: 'left', width: 45 })
  for (const col of columns) {
    if (col.role === 'MEASURE') meta.push({ numFmt: 'money', align: 'right' })
    else meta.push({ align: col.align === 'RIGHT' ? 'right' : 'left' })
  }
  return meta
}

/** Шапка листа: организация + период + подзаголовки. */
const sheetChrome = (result: ReportAltResultDto) => {
  const subtitleLines: string[] = []
  if (result.organizationTitle) subtitleLines.push(result.organizationTitle)
  if (result.periodLine) subtitleLines.push(result.periodLine)
  if (result.subtitleLines) subtitleLines.push(...result.subtitleLines)
  return {
    title: formatReportTitle(result) || result.reportNameRu,
    subtitleLines,
  }
}

/**
 * Готовит результат ReportAlt-отчёта к выгрузке в Excel (компактный аналог
 * легаси `build-report-export`): LEDGER — реальные колонки + span-строки;
 * TREE — колонка-группа с отступом по уровню + дерево + строка «Итого».
 */
export const buildReportAltExport = (
  result: ReportAltResultDto,
  isKz: boolean,
  groupHeader: string,
  totalLabel: string
): TableExportData => {
  const columns = result.columns
  const out: XlsxCell[][] = []
  const rowKinds: XlsxRowKind[] = []

  if (result.layout === 'LEDGER') {
    for (const row of result.rows) {
      rowKinds.push(rowKindOf(row))
      if (isSpanRow(row)) {
        const span = Math.min(
          Math.max(row.labelColSpan ?? 1, 1),
          columns.length
        )
        const line: XlsxCell[] = []
        for (let i = 0; i < span; i++) {
          line.push(i === 0 ? (row.labelText ?? row.groupValue ?? '') : '')
        }
        for (let i = span; i < columns.length; i++) {
          line.push(formatCell(row.cells[columns[i].code], columns[i]))
        }
        out.push(line)
      } else {
        out.push(columns.map((c) => formatCell(row.cells[c.code], c)))
      }
    }
    return {
      ...sheetChrome(result),
      headers: columns.map((c) => columnTitle(c, isKz)),
      columns: buildColumnMeta(columns, false),
      rows: out,
      rowKinds,
    }
  }

  // TREE: служебная первая колонка — наименование группы с отступом по уровню.
  const walk = (rows: ReportAltRowDto[]) => {
    for (const row of rows) {
      rowKinds.push(rowKindOf(row))
      out.push([
        `${'  '.repeat(row.level)}${row.labelText ?? row.groupValue ?? ''}`,
        ...columns.map((c) => formatCell(row.cells[c.code], c)),
      ])
      if (row.children.length > 0) walk(row.children)
    }
  }
  walk(result.rows)

  if (Object.keys(result.total).length > 0) {
    rowKinds.push('highlight')
    out.push([
      totalLabel,
      ...columns.map((c) => formatCell(result.total[c.code], c)),
    ])
  }

  return {
    ...sheetChrome(result),
    headers: [groupHeader, ...columns.map((c) => columnTitle(c, isKz))],
    columns: buildColumnMeta(columns, true),
    rows: out,
    rowKinds,
  }
}
