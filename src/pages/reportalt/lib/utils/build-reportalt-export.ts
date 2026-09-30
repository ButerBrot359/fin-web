import type { TableExportData } from '@/shared/lib/table-export'
import type {
  XlsxCell,
  XlsxColumnMeta,
  XlsxHeaderCell,
  XlsxRowKind,
} from '@/shared/lib/xlsx/write-xlsx'
import { formatDate } from '@/shared/lib/utils/date'
import { displayPatternForFormat } from '@/shared/lib/utils/iso-date'
import {
  buildHeadModel,
  buildPathHeadModel,
  formatReportTitle,
  hasHeaderPath,
  isHighlightRow,
} from '@/features/report-result-view'

import type {
  ReportAltColumnDto,
  ReportAltResultDto,
  ReportAltRowDto,
} from '../../types/reportalt'

/** Локализованный заголовок колонки. */
const columnTitle = (col: ReportAltColumnDto, isKz: boolean): string =>
  (isKz ? col.titleKz : col.titleRu) || col.titleRu

const rowKindOf = (row: ReportAltRowDto): XlsxRowKind =>
  isHighlightRow(row.rowKind) ? 'highlight' : 'data'

/** Span-строка LEDGER (Сальдо/Обороты/Итого) с подписью labelText. */
const isSpanRow = (row: ReportAltRowDto): boolean =>
  isHighlightRow(row.rowKind) &&
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
    return formatDate(value, displayPatternForFormat(col.format)) || value
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

const buildPathHeaderRows = (
  columns: ReportAltColumnDto[],
  isKz: boolean,
  leadColumnTitle?: string,
  leadColumnNumber = ''
): XlsxHeaderCell[][] => {
  const offset = leadColumnTitle != null ? 1 : 0
  const model = buildPathHeadModel(columns, { isKz })
  const rows: XlsxHeaderCell[][] = model.rows.map((cells) =>
    cells.map((cell) => {
      const out: XlsxHeaderCell = { text: cell.title, col: cell.col0 + offset }
      if (cell.colSpan > 1) out.colSpan = cell.colSpan
      if (cell.rowSpan > 1) out.rowSpan = cell.rowSpan
      if (cell.vertical) out.vertical = true
      return out
    })
  )
  if (leadColumnTitle != null) {
    const lead: XlsxHeaderCell = { text: leadColumnTitle, col: 0 }
    if (model.depth > 1) lead.rowSpan = model.depth
    rows[0].unshift(lead)
  }
  if (columns.some((c) => !!c.columnNumber)) {
    const numbers: XlsxHeaderCell[] = columns.map((c, i) => ({
      text: c.columnNumber ?? '',
      col: i + offset,
    }))
    if (leadColumnTitle != null)
      numbers.unshift({ text: leadColumnNumber, col: 0 })
    rows.push(numbers)
  }
  return rows
}

const buildNumberedHeaderRows = (
  columns: ReportAltColumnDto[],
  isKz: boolean,
  leadColumnTitle?: string,
  leadColumnNumber = ''
): XlsxHeaderCell[][] | undefined => {
  if (hasHeaderPath(columns))
    return buildPathHeaderRows(columns, isKz, leadColumnTitle, leadColumnNumber)
  if (!columns.some((c) => !!c.columnNumber)) return undefined
  const offset = leadColumnTitle != null ? 1 : 0
  const model = buildHeadModel(columns, { isKz, levels: 2 })
  const numbers: XlsxHeaderCell[] = columns.map((c, i) => ({
    text: c.columnNumber ?? '',
    col: i + offset,
  }))
  if (leadColumnTitle != null)
    numbers.unshift({ text: leadColumnNumber, col: 0 })

  if (!model.hasGroups) {
    const titles: XlsxHeaderCell[] = columns.map((c, i) => ({
      text: columnTitle(c, isKz),
      col: i + offset,
    }))
    if (leadColumnTitle != null)
      titles.unshift({ text: leadColumnTitle, col: 0 })
    return [titles, numbers]
  }

  const top: XlsxHeaderCell[] = []
  if (leadColumnTitle != null) {
    top.push({ text: leadColumnTitle, col: 0, rowSpan: 2 })
  }
  for (const cell of model.topRow) {
    top.push(
      cell.col != null
        ? { text: cell.title, col: cell.col0 + offset, rowSpan: 2 }
        : { text: cell.title, col: cell.col0 + offset, colSpan: cell.colSpan }
    )
  }
  const sub: XlsxHeaderCell[] = model.leafRow.map((leaf) => ({
    text: columnTitle(leaf.col, isKz),
    col: leaf.col0 + offset,
  }))
  return [top, sub, numbers]
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
      headerRows: buildNumberedHeaderRows(columns, isKz),
      columns: buildColumnMeta(columns, false),
      rows: out,
      rowKinds,
    }
  }

  // TREE: служебная первая колонка — наименование группы с отступом по уровню.
  const tree = columns.find((c) => c.treeColumn)
  const body = tree ? columns.filter((c) => c !== tree) : columns
  const leadHeader = tree ? columnTitle(tree, isKz) : groupHeader
  const leadLabel = (row: ReportAltRowDto): string => {
    const own = tree ? row.cells[tree.code] : undefined
    return typeof own === 'string' && own !== ''
      ? own
      : (row.labelText ?? row.groupValue ?? '')
  }
  const walk = (rows: ReportAltRowDto[]) => {
    for (const row of rows) {
      rowKinds.push(rowKindOf(row))
      out.push([
        `${'  '.repeat(row.level)}${row.labelText ?? leadLabel(row)}`,
        ...body.map((c) => formatCell(row.cells[c.code], c)),
      ])
      if (row.children.length > 0) walk(row.children)
    }
  }
  walk(result.rows)

  if (Object.keys(result.total).length > 0) {
    rowKinds.push('highlight')
    out.push([
      totalLabel,
      ...body.map((c) => formatCell(result.total[c.code], c)),
    ])
  }

  return {
    ...sheetChrome(result),
    headers: [leadHeader, ...body.map((c) => columnTitle(c, isKz))],
    headerRows: buildNumberedHeaderRows(
      body,
      isKz,
      leadHeader,
      tree?.columnNumber ?? ''
    ),
    columns: buildColumnMeta(body, true),
    rows: out,
    rowKinds,
  }
}
