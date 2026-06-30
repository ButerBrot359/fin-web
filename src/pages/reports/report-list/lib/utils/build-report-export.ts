import type { TableExportData } from '@/shared/lib/table-export'
import { formatWithSpaces } from '@/shared/lib/utils/format-cell-value'

import type {
  ReportColumnDto,
  ReportResultDto,
  ReportRowDto,
} from '../../types/report'

/** Локализованный заголовок колонки. */
const columnTitle = (col: ReportColumnDto, isKz: boolean): string =>
  (isKz ? col.titleKz : col.titleRu) || col.titleRu

/** Вид строки — span-строка (Сальдо/Обороты/Итого), рисуется подписью слева. */
const SPAN_KINDS = new Set([
  'OPENING_BALANCE',
  'TURNOVER',
  'CLOSING_BALANCE',
  'SUBTOTAL',
  'TOTAL',
])

/**
 * Значение ячейки для Excel: массив (многострочная аналитика Дт/Кт) → строки
 * через перенос; MEASURE → формат с разрядами; пусто для null/0-строк.
 */
const formatCell = (value: unknown, col: ReportColumnDto): string | number => {
  if (value == null || value === '') return ''
  if (Array.isArray(value)) {
    return value.filter((v) => v != null && v !== '').join('\n')
  }
  if (col.role === 'MEASURE') {
    const n = typeof value === 'number' ? value : Number(value)
    if (!Number.isNaN(n)) {
      if (n === 0 && col.blankOnZero) return ''
      return formatWithSpaces(String(n))
    }
  }
  if (typeof value === 'string' || typeof value === 'number') return value
  return ''
}

/**
 * Готовит данные результата отчёта для выгрузки в Excel — 1 в 1 с таблицей
 * (`ReportResultView`). Layout-aware:
 *
 * - **LEDGER** (Карточка/Проводки): колонки = реальные колонки результата (без
 *   служебной колонки «Группа»). Span-строки (Сальдо/Обороты/Итого) выводят
 *   `labelText` в первую колонку и суммы — в остальные.
 * - **TREE** (ОСВ/Анализ/Обороты): первая колонка — наименование группы с
 *   отступом по уровню; дерево обходится в глубину; строка «Итого» из
 *   `result.total`.
 *
 * Скрытые настройками колонки исключаются (передаются уже отфильтрованные).
 */
export const buildReportExport = (
  result: ReportResultDto,
  columns: ReportColumnDto[],
  groupHeader: string,
  isKz: boolean,
  totalLabel: string
): TableExportData => {
  if (result.layout === 'LEDGER') {
    return buildLedgerExport(result, columns, isKz)
  }
  return buildTreeExport(result, columns, groupHeader, isKz, totalLabel)
}

/** LEDGER: реальные колонки + span-строки по rowKind. */
const buildLedgerExport = (
  result: ReportResultDto,
  columns: ReportColumnDto[],
  isKz: boolean
): TableExportData => {
  const headers = columns.map((c) => columnTitle(c, isKz))
  const out: (string | number | null)[][] = []

  for (const row of result.rows) {
    if (row.rowKind && SPAN_KINDS.has(row.rowKind)) {
      const span = Math.min(Math.max(row.labelColSpan ?? 1, 1), columns.length)
      const line: (string | number | null)[] = []
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

  return { headers, rows: out }
}

/** TREE: служебная колонка-группа с отступом + дерево + строка «Итого». */
const buildTreeExport = (
  result: ReportResultDto,
  columns: ReportColumnDto[],
  groupHeader: string,
  isKz: boolean,
  totalLabel: string
): TableExportData => {
  const headers = [groupHeader, ...columns.map((c) => columnTitle(c, isKz))]
  const out: (string | number | null)[][] = []

  const walk = (rows: ReportRowDto[]) => {
    for (const row of rows) {
      const indent = '  '.repeat(row.level)
      const label = row.labelText ?? row.groupValue ?? ''
      out.push([
        `${indent}${label}`,
        ...columns.map((c) => formatCell(row.cells[c.code], c)),
      ])
      if (row.children.length > 0) walk(row.children)
    }
  }
  walk(result.rows)

  if (Object.keys(result.total).length > 0) {
    out.push([
      totalLabel,
      ...columns.map((c) => formatCell(result.total[c.code], c)),
    ])
  }

  return { headers, rows: out }
}
