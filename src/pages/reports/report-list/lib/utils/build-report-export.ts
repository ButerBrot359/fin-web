import type { TableExportData } from '@/shared/lib/table-export'
import type {
  XlsxCell,
  XlsxColumnMeta,
  XlsxHeaderCell,
  XlsxRowKind,
} from '@/shared/lib/xlsx/write-xlsx'
import { formatDate } from '@/shared/lib/utils/date'
import {
  buildHeadModel,
  formatMoney1C,
  formatReportTitle,
  isHighlightRow,
} from '@/features/report-result-view'

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

/** Вид строки — span-строка (Сальдо/Обороты/Итого) С ПОДПИСЬЮ labelText. */
const isSpanExportRow = (row: ReportRowDto): boolean =>
  isHighlightRow(row.rowKind) &&
  row.rowKind !== 'GROUP_HEADER' &&
  row.labelText != null

const rowKindOf = (row: ReportRowDto): XlsxRowKind =>
  isHighlightRow(row.rowKind) ? 'highlight' : 'data'

/**
 * Двухуровневая шапка листа из колонок с `groupTitle` («Дебет» над
 * [Счет|Сумма]); колонки без группы занимают оба ряда (rowSpan=2).
 * Если групп нет — одноуровневая. Модель строит общий {@link buildHeadModel}
 * (глубина 2, без разбора склейки « — » — историческое поведение экспорта);
 * здесь она раскладывается в XlsxHeaderCell с абсолютными индексами колонок.
 */
const buildHeaderRows = (
  columns: ReportColumnDto[],
  isKz: boolean,
  leadColumnTitle?: string
): XlsxHeaderCell[][] => {
  const offset = leadColumnTitle != null ? 1 : 0
  const model = buildHeadModel(columns, { isKz, levels: 2 })

  if (!model.hasGroups) {
    const row: XlsxHeaderCell[] = []
    if (leadColumnTitle != null) row.push({ text: leadColumnTitle, col: 0 })
    columns.forEach((c, i) =>
      row.push({ text: columnTitle(c, isKz), col: i + offset })
    )
    return [row]
  }

  const top: XlsxHeaderCell[] = []
  const sub: XlsxHeaderCell[] = []
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
  for (const leaf of model.leafRow) {
    sub.push({ text: columnTitle(leaf.col, isKz), col: leaf.col0 + offset })
  }
  return [top, sub]
}

/** Метаданные колонок листа: числовой формат и выравнивание. */
const buildColumnMeta = (
  columns: ReportColumnDto[],
  hasLeadColumn: boolean
): XlsxColumnMeta[] => {
  const meta: XlsxColumnMeta[] = []
  if (hasLeadColumn) meta.push({ align: 'left', width: 45 })
  for (const col of columns) {
    if (col.role === 'MEASURE') {
      meta.push({ numFmt: 'money', align: 'right' })
    } else {
      meta.push({ align: col.align === 'RIGHT' ? 'right' : 'left' })
    }
  }
  return meta
}

/**
 * Значение ячейки для Excel:
 * - одиночное число MEASURE → НАСТОЯЩЕЕ число (формат разрядов даёт Excel);
 *   `blankOnZero` ⇒ пусто; `dcIndicator` ⇒ текст «Д <abs>»/«К <abs>»;
 * - массив в MEASURE — подстроки-показатели, отформатированные текстом
 *   (2 знака, «Кол.» — 3) через перенос строки;
 * - массив в остальных — многострочная аналитика через перенос;
 * - PERIOD — дата в 1С-формате.
 */
const formatCell = (
  value: unknown,
  col: ReportColumnDto,
  subLabels?: string[]
): XlsxCell => {
  if (value == null || value === '') return ''
  if (Array.isArray(value)) {
    if (col.role === 'MEASURE') {
      return value
        .map((v, i) => {
          if (v == null || v === '') return ''
          const n = typeof v === 'number' ? v : Number(v)
          if (Number.isNaN(n)) return safeText(v)
          if (n === 0 && col.blankOnZero) return ''
          if (col.dcIndicator) {
            return `${n < 0 ? 'К' : 'Д'} ${formatMoney1C(Math.abs(n), subDecimals(subLabels, i))}`
          }
          return formatMoney1C(n, subDecimals(subLabels, i))
        })
        .join('\n')
    }
    return value.filter((v) => v != null && v !== '').join('\n')
  }
  if (col.role === 'MEASURE') {
    const n = typeof value === 'number' ? value : Number(value)
    if (!Number.isNaN(n)) {
      if (n === 0 && col.blankOnZero) return ''
      if (col.dcIndicator) {
        return `${n < 0 ? 'К' : 'Д'} ${formatMoney1C(Math.abs(n), 2)}`
      }
      return n
    }
  }
  if (
    col.role === 'PERIOD' &&
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}/.test(value)
  ) {
    const pattern = col.format?.includes('HH')
      ? 'dd.MM.yyyy HH:mm:ss'
      : 'dd.MM.yyyy'
    return formatDate(value, pattern) || value
  }
  if (typeof value === 'string' || typeof value === 'number') return value
  return ''
}

/** Число знаков подстроки-показателя: «Кол.» — 3, остальные — 2. */
const subDecimals = (subLabels: string[] | undefined, i: number): number =>
  subLabels?.[i] === 'Кол.' ? 3 : 2

/** Безопасный текст для нечисловых значений подстрок. */
const safeText = (v: unknown): string =>
  typeof v === 'string' ? v : typeof v === 'number' ? String(v) : ''

/**
 * Общая «шапка листа»: гос-бланк (headerBlocks) + организация + строка периода +
 * подзаголовки. Excel не позиционирует бланк точь-в-точь как экран — строки
 * попадают под титул (SHOULD: «добавить строки сверху листа»), данные не теряются.
 */
const sheetChrome = (result: ReportResultDto) => {
  const subtitleLines: string[] = []
  for (const block of result.headerBlocks ?? []) {
    subtitleLines.push(...block.lines)
    if (block.caption) subtitleLines.push(block.caption)
  }
  if (result.organizationTitle) subtitleLines.push(result.organizationTitle)
  if (result.periodLine) subtitleLines.push(result.periodLine)
  if (result.subtitleLines) subtitleLines.push(...result.subtitleLines)
  return {
    title: formatReportTitle(result) || result.reportNameRu,
    subtitleLines,
  }
}

/**
 * Дописывает подвал-подписи (footerBlock) отдельными строками в конец листа:
 * пустая строка-разделитель, затем роль + ФИО (над последней графой), затем
 * подписи граф. Роль — в первой колонке, графы — начиная со второй.
 */
const appendFooter = (
  out: XlsxCell[][],
  rowKinds: XlsxRowKind[],
  result: ReportResultDto
): void => {
  const footer = result.footerBlock
  if (!footer) return
  const captions = footer.captions ?? ['подпись']
  const lastIdx = captions.length - 1
  out.push([''])
  rowKinds.push('data')
  out.push([
    footer.role,
    ...captions.map((_c, i) => (i === lastIdx ? (footer.name ?? '') : '')),
  ])
  rowKinds.push('data')
  out.push(['', ...captions])
  rowKinds.push('data')
}

/**
 * Готовит данные результата отчёта для выгрузки в Excel — 1 в 1 с таблицей
 * (`ReportResultView`), в бизнес-оформлении: заголовок листа, двухуровневая
 * шапка, числовые ячейки с форматом разрядов, выделенные итоги, автоширина.
 *
 * - **LEDGER** (Карточка/Проводки/Анализ/Обороты): колонки = реальные колонки
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
  const out: XlsxCell[][] = []
  const rowKinds: XlsxRowKind[] = []

  for (const row of result.rows) {
    const subLabels = Array.isArray(row.cells[POKAZATEL_COL])
      ? (row.cells[POKAZATEL_COL] as unknown[]).map((x) => String(x))
      : undefined
    rowKinds.push(rowKindOf(row))
    if (isSpanExportRow(row)) {
      const span = Math.min(Math.max(row.labelColSpan ?? 1, 1), columns.length)
      const line: XlsxCell[] = []
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

  appendFooter(out, rowKinds, result)

  return {
    ...sheetChrome(result),
    headers: columns.map((c) => columnTitle(c, isKz)),
    headerRows: buildHeaderRows(columns, isKz),
    columns: buildColumnMeta(columns, false),
    rows: out,
    rowKinds,
  }
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

  const out: XlsxCell[][] = []
  const rowKinds: XlsxRowKind[] = []

  const walk = (rows: ReportRowDto[]) => {
    for (const row of rows) {
      const indent = '  '.repeat(row.level)
      const label = row.labelText ?? row.groupValue ?? ''
      rowKinds.push(rowKindOf(row))
      out.push([
        `${indent}${label}`,
        ...bodyColumns.map((c) => formatCell(row.cells[c.code], c)),
      ])
      if (row.children.length > 0) walk(row.children)
    }
  }
  walk(result.rows)

  if (Object.keys(result.total).length > 0) {
    rowKinds.push('highlight')
    out.push([
      totalLabel,
      ...bodyColumns.map((c) => formatCell(result.total[c.code], c)),
    ])
  }

  appendFooter(out, rowKinds, result)

  return {
    ...sheetChrome(result),
    headers: [firstHeader, ...bodyColumns.map((c) => columnTitle(c, isKz))],
    headerRows: buildHeaderRows(bodyColumns, isKz, firstHeader),
    columns: buildColumnMeta(bodyColumns, true),
    rows: out,
    rowKinds,
  }
}
