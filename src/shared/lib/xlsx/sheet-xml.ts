/**
 * Типы данных листа и генерация `xl/worksheets/sheet1.xml`: нормализация
 * входа, автоширина колонок, XML ячеек/строк/шапки, merge и закрепление.
 */
import { XF } from './xlsx-styles'

/** Значение ячейки: строка (inlineStr) или число (числовая ячейка). */
export type XlsxCell = string | number | null | undefined

/** Ячейка шапки: текст + объединение по колонкам/строкам. */
export interface XlsxHeaderCell {
  text: string
  colSpan?: number
  rowSpan?: number
  /** Индекс колонки (0-based), с которой начинается ячейка. */
  col: number
}

/** Метаданные колонки для оформления и автоширины. */
export interface XlsxColumnMeta {
  /** Числовой формат значений-чисел этой колонки. */
  numFmt?: 'money' | 'quantity'
  /** Выравнивание текстовых ячеек (числа всегда справа). */
  align?: 'left' | 'right'
  /** Явная ширина в символах (иначе — автоширина по содержимому). */
  width?: number
}

/** Вид строки данных: обычная или выделенная (итоги/сальдо/группы). */
export type XlsxRowKind = 'data' | 'highlight'

export interface XlsxSheet {
  /** Имя листа (Excel ограничивает 31 символом, запрещает : \ / ? * [ ]). */
  name: string
  /** Заголовки колонок (одноуровневая шапка; игнорируется при headerRows). */
  headers: string[]
  /** Строки данных. */
  rows: XlsxCell[][]
  /** Заголовок листа («Карточка счета 1316 за …») — merged строка сверху. */
  title?: string
  /** Подзаголовки (организация, «Выводимые данные: …») под заголовком. */
  subtitleLines?: string[]
  /** Многоуровневая шапка (имеет приоритет над headers). */
  headerRows?: XlsxHeaderCell[][]
  /** Метаданные колонок (числовой формат/выравнивание/ширина). */
  columns?: XlsxColumnMeta[]
  /** Вид каждой строки данных (для выделения итогов); по умолчанию data. */
  rowKinds?: XlsxRowKind[]
}

export const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // Управляющие символы недопустимы в XML 1.0 — вырезаем, кроме \t \n \r.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')

/** Индекс колонки (0-based) → буквенное имя Excel: 0→A, 25→Z, 26→AA. */
const columnLetter = (index: number): string => {
  let result = ''
  let n = index
  do {
    result = String.fromCharCode(65 + (n % 26)) + result
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return result
}

const sanitizeSheetName = (name: string): string => {
  const cleaned = name.replace(/[:\\/?*[\]]/g, ' ').trim()
  return (cleaned || 'Sheet1').slice(0, 31)
}

// ─── Лист ────────────────────────────────────────────────────────────────────

export interface NormalizedSheet {
  name: string
  columnCount: number
  title?: string
  subtitleLines: string[]
  headerRows: XlsxHeaderCell[][]
  columns: XlsxColumnMeta[]
  rows: XlsxCell[][]
  rowKinds: XlsxRowKind[]
}

export const normalizeSheet = (sheet: XlsxSheet): NormalizedSheet => {
  const headerRows: XlsxHeaderCell[][] =
    sheet.headerRows && sheet.headerRows.length > 0
      ? sheet.headerRows
      : [sheet.headers.map((text, col) => ({ text, col }))]

  const columnCount = Math.max(
    sheet.headers.length,
    ...headerRows.map((r) =>
      r.reduce((m, c) => Math.max(m, c.col + (c.colSpan ?? 1)), 0)
    ),
    ...sheet.rows.map((r) => r.length)
  )

  return {
    name: sanitizeSheetName(sheet.name),
    columnCount,
    title: sheet.title,
    subtitleLines: sheet.subtitleLines ?? [],
    headerRows,
    columns: Array.from(
      { length: columnCount },
      (_, i) => sheet.columns?.[i] ?? {}
    ),
    rows: sheet.rows,
    rowKinds: sheet.rows.map((_, i) => sheet.rowKinds?.[i] ?? 'data'),
  }
}

/** Ширина текста в «символах» Excel: кириллица и цифры чуть шире латиницы. */
const textUnits = (line: string): number => {
  let units = 0
  for (const ch of line) {
    units += /[А-Яа-яЁё]/.test(ch) ? 1.15 : 1
  }
  return units
}

/**
 * Автоширина колонок: максимум по шапке и содержимому (многострочные ячейки
 * считаются по самой длинной строке), в разумных пределах [9..55].
 */
export const computeColumnWidths = (s: NormalizedSheet): number[] => {
  const widths = Array.from({ length: s.columnCount }, () => 9)

  const bump = (col: number, text: string, max: number) => {
    for (const line of text.split('\n')) {
      widths[col] = Math.min(
        max,
        Math.max(widths[col], Math.ceil(textUnits(line)) + 3)
      )
    }
  }

  for (const row of s.headerRows) {
    for (const cell of row) {
      const span = cell.colSpan ?? 1
      if (span === 1) bump(cell.col, cell.text, 40)
    }
  }
  for (const row of s.rows) {
    row.forEach((cell, col) => {
      if (cell == null || cell === '') return
      if (typeof cell === 'number') {
        // Числа: длина форматированного значения с разрядами и копейками.
        const approx = Math.trunc(Math.abs(cell)).toString().length
        bump(col, '9'.repeat(approx + Math.floor(approx / 3) + 4), 24)
        return
      }
      bump(col, cell, 55)
    })
  }

  return s.columns.map((meta, i) => meta.width ?? widths[i])
}

export const buildCellXml = (
  cell: XlsxCell,
  colIndex: number,
  rowRef: number,
  styleId: number
): string => {
  const ref = `${columnLetter(colIndex)}${String(rowRef)}`
  const s = styleId > 0 ? ` s="${String(styleId)}"` : ''
  if (cell == null || cell === '') {
    // Пустая ячейка со стилем — нужна, чтобы сетка/заливка не рвались.
    return styleId > 0 ? `<c r="${ref}"${s}/>` : ''
  }
  if (typeof cell === 'number' && Number.isFinite(cell)) {
    return `<c r="${ref}"${s}><v>${String(cell)}</v></c>`
  }
  const text = escapeXml(String(cell))
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`
}

/** Стиль ячейки данных по колонке, типу значения и виду строки. */
const dataCellStyle = (
  cell: XlsxCell,
  meta: XlsxColumnMeta,
  kind: XlsxRowKind
): number => {
  const hl = kind === 'highlight'
  if (typeof cell === 'number' && meta.numFmt === 'quantity') {
    return hl ? XF.HL_QTY : XF.DATA_QTY
  }
  if (typeof cell === 'number' && meta.numFmt) {
    return hl ? XF.HL_MONEY : XF.DATA_MONEY
  }
  const right =
    meta.align === 'right' || (meta.numFmt != null && typeof cell !== 'number')
  if (right) return hl ? XF.HL_RIGHT : XF.DATA_RIGHT
  return hl ? XF.HL_LEFT : XF.DATA_LEFT
}

export const buildSheetXml = (s: NormalizedSheet): string => {
  const widths = computeColumnWidths(s)
  const merges: string[] = []
  const rowsXml: string[] = []
  let rowRef = 1

  const fullWidthMerge = (r: number) => {
    if (s.columnCount > 1) {
      merges.push(
        `A${String(r)}:${columnLetter(s.columnCount - 1)}${String(r)}`
      )
    }
  }

  // Заголовок листа.
  if (s.title) {
    fullWidthMerge(rowRef)
    rowsXml.push(
      `<row r="${String(rowRef)}" ht="24" customHeight="1">` +
        buildCellXml(s.title, 0, rowRef, XF.TITLE) +
        '</row>'
    )
    rowRef++
  }
  for (const line of s.subtitleLines) {
    fullWidthMerge(rowRef)
    rowsXml.push(
      `<row r="${String(rowRef)}" ht="14" customHeight="1">` +
        buildCellXml(line, 0, rowRef, XF.SUBTITLE) +
        '</row>'
    )
    rowRef++
  }
  // Отступ между заголовком и таблицей.
  if (s.title || s.subtitleLines.length > 0) {
    rowsXml.push(`<row r="${String(rowRef)}" ht="6" customHeight="1"/>`)
    rowRef++
  }

  // Шапка (возможно двухуровневая, с merge по colSpan/rowSpan).
  const headerStart = rowRef
  const headerDepth = s.headerRows.length
  for (let level = 0; level < headerDepth; level++) {
    const occupied = new Map<number, number>() // col → styleId (для rowSpan-заглушек)
    for (const cell of s.headerRows[level]) {
      const colSpan = cell.colSpan ?? 1
      const rowSpan = cell.rowSpan ?? 1
      if (colSpan > 1 || rowSpan > 1) {
        merges.push(
          `${columnLetter(cell.col)}${String(rowRef)}:` +
            `${columnLetter(cell.col + colSpan - 1)}${String(rowRef + rowSpan - 1)}`
        )
      }
      occupied.set(cell.col, XF.HEADER)
    }
    const cells: string[] = []
    for (let col = 0; col < s.columnCount; col++) {
      const isAnchor = occupied.has(col)
      const anchor = s.headerRows[level].find((c) => c.col === col)
      cells.push(
        buildCellXml(
          isAnchor && anchor ? anchor.text : '',
          col,
          rowRef,
          XF.HEADER
        )
      )
    }
    rowsXml.push(
      `<row r="${String(rowRef)}" ht="22" customHeight="1">${cells.join('')}</row>`
    )
    rowRef++
  }

  // Данные.
  for (let i = 0; i < s.rows.length; i++) {
    const row = s.rows[i]
    const kind = s.rowKinds[i]
    const cells: string[] = []
    for (let col = 0; col < s.columnCount; col++) {
      cells.push(
        buildCellXml(
          row[col],
          col,
          rowRef,
          dataCellStyle(row[col], s.columns[col], kind)
        )
      )
    }
    rowsXml.push(`<row r="${String(rowRef)}">${cells.join('')}</row>`)
    rowRef++
  }

  const colsXml = widths
    .map(
      (w, i) =>
        `<col min="${String(i + 1)}" max="${String(i + 1)}" width="${String(w)}" customWidth="1"/>`
    )
    .join('')

  // Закрепляем всё до конца шапки (заголовок + подзаголовки + шапка колонок).
  const freezeAt = headerStart + headerDepth - 1
  const sheetViews =
    '<sheetViews><sheetView workbookViewId="0" showGridLines="false">' +
    `<pane ySplit="${String(freezeAt)}" topLeftCell="A${String(freezeAt + 1)}" activePane="bottomLeft" state="frozen"/>` +
    '</sheetView></sheetViews>'

  const mergesXml =
    merges.length > 0
      ? `<mergeCells count="${String(merges.length)}">` +
        merges.map((m) => `<mergeCell ref="${m}"/>`).join('') +
        '</mergeCells>'
      : ''

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    sheetViews +
    `<cols>${colsXml}</cols>` +
    `<sheetData>${rowsXml.join('')}</sheetData>` +
    mergesXml +
    '</worksheet>'
  )
}
