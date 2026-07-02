import type { TableExportData } from '@/shared/lib/table-export'
import { formatMoney1C } from '@/features/report-result-view'

import type {
  ReportColumnDto,
  ReportResultDto,
  ReportRowDto,
} from '../../types/report'

/** Код колонки «Показатель» — подписи подстрок (Сумма/Кол.) в LEDGER. */
const POKAZATEL_COL = 'Pokazatel'

/** Локализованный заголовок колонки. */
const columnTitle = (col: ReportColumnDto, isKz: boolean): string =>
  (isKz ? col.titleKz : col.titleRu) || col.titleRu

/**
 * Заголовок колонки для Excel с учётом двухуровневой шапки: «Дебет / Счет».
 */
const exportTitle = (col: ReportColumnDto, isKz: boolean): string => {
  const group = (isKz ? col.groupTitleKz : col.groupTitleRu) || col.groupTitleRu
  const title = columnTitle(col, isKz)
  if (group && title) return `${group} / ${title}`
  return group || title
}

/** Вид строки — span-строка (Сальдо/Обороты/Итого) С ПОДПИСЬЮ labelText. */
const SPAN_KINDS = new Set([
  'OPENING_BALANCE',
  'TURNOVER',
  'CLOSING_BALANCE',
  'SUBTOTAL',
  'TOTAL',
])

const isSpanExportRow = (row: ReportRowDto): boolean =>
  row.rowKind != null && SPAN_KINDS.has(row.rowKind) && row.labelText != null

/**
 * Значение ячейки для Excel: массив в MEASURE — подстроки-показатели с 1С-
 * форматом (2 знака, «Кол.» — 3) через перенос; массив в остальных —
 * многострочная аналитика; MEASURE — 1С-формат с разрядами; dcIndicator —
 * «Д <abs>»/«К <abs>»; пусто для null/0-при-blankOnZero.
 */
const formatCell = (
  value: unknown,
  col: ReportColumnDto,
  subLabels?: string[]
): string | number => {
  if (value == null || value === '') return ''
  if (Array.isArray(value)) {
    if (col.role === 'MEASURE') {
      return value
        .map((v, i) => {
          if (v == null || v === '') return ''
          const n = typeof v === 'number' ? v : Number(v)
          if (Number.isNaN(n)) return safeText(v)
          return formatMeasure(n, col, subLabels?.[i] === 'Кол.' ? 3 : 2)
        })
        .join('\n')
    }
    return value.filter((v) => v != null && v !== '').join('\n')
  }
  if (col.role === 'MEASURE') {
    const n = typeof value === 'number' ? value : Number(value)
    if (!Number.isNaN(n)) {
      return formatMeasure(n, col, 2)
    }
  }
  if (typeof value === 'string' || typeof value === 'number') return value
  return ''
}

/** Безопасный текст для нечисловых значений подстрок. */
const safeText = (v: unknown): string =>
  typeof v === 'string' ? v : typeof v === 'number' ? String(v) : ''

/** 1С-формат числа с учётом blankOnZero и признака Д/К. */
const formatMeasure = (
  n: number,
  col: ReportColumnDto,
  decimals: number
): string => {
  if (n === 0 && col.blankOnZero) return ''
  if (col.dcIndicator) {
    return `${n < 0 ? 'К' : 'Д'} ${formatMoney1C(Math.abs(n), decimals)}`
  }
  return formatMoney1C(n, decimals)
}

/**
 * Готовит данные результата отчёта для выгрузки в Excel — 1 в 1 с таблицей
 * (`ReportResultView`). Layout-aware:
 *
 * - **LEDGER** (Карточка/Проводки/Анализ): колонки = реальные колонки
 *   результата. Span-строки (с labelText) выводят подпись в первую колонку и
 *   суммы — в остальные; выделенные строки без labelText — обычные ячейки.
 * - **TREE** (ОСВ): первая колонка — наименование группы с отступом по уровню;
 *   дерево обходится в глубину; строка «Итого» из `result.total`.
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
  const headers = columns.map((c) => exportTitle(c, isKz))
  const out: (string | number | null)[][] = []

  for (const row of result.rows) {
    const subLabels = Array.isArray(row.cells[POKAZATEL_COL])
      ? (row.cells[POKAZATEL_COL] as unknown[]).map((x) => String(x))
      : undefined
    if (isSpanExportRow(row)) {
      const span = Math.min(Math.max(row.labelColSpan ?? 1, 1), columns.length)
      const line: (string | number | null)[] = []
      for (let i = 0; i < span; i++) {
        line.push(i === 0 ? (row.labelText ?? row.groupValue ?? '') : '')
      }
      for (let i = span; i < columns.length; i++) {
        line.push(formatCell(row.cells[columns[i].code], columns[i], subLabels))
      }
      out.push(line)
    } else {
      out.push(columns.map((c) => formatCell(row.cells[c.code], c, subLabels)))
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
  // Колонка дерева (первая DIMENSION без собственных значений) не дублируется.
  const treeCol = result.columns.find((c) => c.role === 'DIMENSION')
  const treeColUsed =
    treeCol &&
    result.rows.some((r) => r.groupCode === treeCol.code) &&
    !result.rows.some(
      (r) => r.cells[treeCol.code] != null && r.cells[treeCol.code] !== ''
    )
  const bodyColumns = treeColUsed
    ? columns.filter((c) => c.code !== treeCol.code)
    : columns
  const firstHeader = treeColUsed ? columnTitle(treeCol, isKz) : groupHeader

  const headers = [firstHeader, ...bodyColumns.map((c) => exportTitle(c, isKz))]
  const out: (string | number | null)[][] = []

  const walk = (rows: ReportRowDto[]) => {
    for (const row of rows) {
      const indent = '  '.repeat(row.level)
      const label = row.labelText ?? row.groupValue ?? ''
      out.push([
        `${indent}${label}`,
        ...bodyColumns.map((c) => formatCell(row.cells[c.code], c)),
      ])
      if (row.children.length > 0) walk(row.children)
    }
  }
  walk(result.rows)

  if (Object.keys(result.total).length > 0) {
    out.push([
      totalLabel,
      ...bodyColumns.map((c) => formatCell(result.total[c.code], c)),
    ])
  }

  return { headers, rows: out }
}
