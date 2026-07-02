/**
 * Минимальный генератор настоящего `.xlsx` (OOXML) без сторонних зависимостей.
 *
 * Зачем свой: npm-пакеты `xlsx`/`exceljs` тянут известные уязвимости в путь
 * ЧТЕНИЯ файлов (нам не нужный) и засоряют `npm audit`. Здесь только ЗАПИСЬ:
 * формируем ZIP-архив (метод store, без сжатия) с обязательными XML-частями.
 * Excel открывает такой файл нативно, без предупреждения о несоответствии
 * формата и расширения (в отличие от трюка «HTML-таблица с расширением .xls»).
 *
 * Поддерживается «бизнес-оформление» листа:
 * - строка заголовка и подзаголовки (merged по ширине таблицы);
 * - одно- или двухуровневая шапка (merge по colSpan/rowSpan), тёмно-зелёная
 *   заливка с белым жирным текстом;
 * - сетка тонкими серыми границами, перенос строк в ячейках;
 * - числовые ячейки с форматом разрядов `# ##0.00` (числа остаются числами);
 * - выделенные строки (итоги/сальдо) — жирные на светло-зелёной подложке;
 * - автоширина колонок по содержимому и закрепление шапки.
 */

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

const textEncoder = new TextEncoder()

const escapeXml = (value: string): string =>
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

// ─── Стили (styles.xml) ──────────────────────────────────────────────────────
// Фиксированная палитра «бизнес-стиля» в фирменном тёмно-зелёном 1С.

const COLOR_HEADER_FILL = 'FF1E5945' // шапка — тёмно-зелёный
const COLOR_HEADER_TEXT = 'FFFFFFFF'
const COLOR_TEXT = 'FF333333'
const COLOR_TITLE = 'FF1E3A2F'
const COLOR_SUBTLE = 'FF6B7280' // подзаголовки — приглушённый серый
const COLOR_HIGHLIGHT_FILL = 'FFE9F2EC' // итоги — светло-зелёная подложка
const COLOR_HIGHLIGHT_TEXT = 'FF003F2F' // текст итогов — зелёный 1С
const COLOR_BORDER = 'FFBFC9C4'

/** Индексы cellXfs в styles.xml (порядок в buildStylesXml). */
const XF = {
  DEFAULT: 0,
  TITLE: 1,
  SUBTITLE: 2,
  HEADER: 3,
  DATA_LEFT: 4,
  DATA_RIGHT: 5,
  DATA_MONEY: 6,
  DATA_QTY: 7,
  HL_LEFT: 8,
  HL_RIGHT: 9,
  HL_MONEY: 10,
  HL_QTY: 11,
} as const

const NUMFMT_MONEY = 164 // # ##0.00
const NUMFMT_QTY = 165 // # ##0.000

const buildStylesXml = (): string =>
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  `<numFmts count="2">` +
  `<numFmt numFmtId="${String(NUMFMT_MONEY)}" formatCode="#,##0.00"/>` +
  `<numFmt numFmtId="${String(NUMFMT_QTY)}" formatCode="#,##0.000"/>` +
  '</numFmts>' +
  '<fonts count="5">' +
  `<font><sz val="10"/><color rgb="${COLOR_TEXT}"/><name val="Arial"/></font>` + // 0 данные
  `<font><b/><sz val="14"/><color rgb="${COLOR_TITLE}"/><name val="Arial"/></font>` + // 1 заголовок
  `<font><sz val="9"/><color rgb="${COLOR_SUBTLE}"/><name val="Arial"/></font>` + // 2 подзаголовок
  `<font><b/><sz val="10"/><color rgb="${COLOR_HEADER_TEXT}"/><name val="Arial"/></font>` + // 3 шапка
  `<font><b/><sz val="10"/><color rgb="${COLOR_HIGHLIGHT_TEXT}"/><name val="Arial"/></font>` + // 4 итоги
  '</fonts>' +
  '<fills count="4">' +
  '<fill><patternFill patternType="none"/></fill>' + // 0 (обязательный)
  '<fill><patternFill patternType="gray125"/></fill>' + // 1 (обязательный)
  `<fill><patternFill patternType="solid"><fgColor rgb="${COLOR_HEADER_FILL}"/></patternFill></fill>` + // 2 шапка
  `<fill><patternFill patternType="solid"><fgColor rgb="${COLOR_HIGHLIGHT_FILL}"/></patternFill></fill>` + // 3 итоги
  '</fills>' +
  '<borders count="2">' +
  '<border><left/><right/><top/><bottom/><diagonal/></border>' + // 0 без границ
  `<border>` + // 1 тонкая сетка
  `<left style="thin"><color rgb="${COLOR_BORDER}"/></left>` +
  `<right style="thin"><color rgb="${COLOR_BORDER}"/></right>` +
  `<top style="thin"><color rgb="${COLOR_BORDER}"/></top>` +
  `<bottom style="thin"><color rgb="${COLOR_BORDER}"/></bottom>` +
  `<diagonal/></border>` +
  '</borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="12">' +
  // 0 DEFAULT
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  // 1 TITLE
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1">' +
  '<alignment vertical="center"/></xf>' +
  // 2 SUBTITLE
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1">' +
  '<alignment vertical="center"/></xf>' +
  // 3 HEADER
  '<xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyAlignment="1">' +
  '<alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
  // 4 DATA_LEFT
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1">' +
  '<alignment horizontal="left" vertical="top" wrapText="1"/></xf>' +
  // 5 DATA_RIGHT
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1">' +
  '<alignment horizontal="right" vertical="top" wrapText="1"/></xf>' +
  // 6 DATA_MONEY
  `<xf numFmtId="${String(NUMFMT_MONEY)}" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1">` +
  '<alignment horizontal="right" vertical="top"/></xf>' +
  // 7 DATA_QTY
  `<xf numFmtId="${String(NUMFMT_QTY)}" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1">` +
  '<alignment horizontal="right" vertical="top"/></xf>' +
  // 8 HL_LEFT
  '<xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyAlignment="1">' +
  '<alignment horizontal="left" vertical="top" wrapText="1"/></xf>' +
  // 9 HL_RIGHT
  '<xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyAlignment="1">' +
  '<alignment horizontal="right" vertical="top" wrapText="1"/></xf>' +
  // 10 HL_MONEY
  `<xf numFmtId="${String(NUMFMT_MONEY)}" fontId="4" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1">` +
  '<alignment horizontal="right" vertical="top"/></xf>' +
  // 11 HL_QTY
  `<xf numFmtId="${String(NUMFMT_QTY)}" fontId="4" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1">` +
  '<alignment horizontal="right" vertical="top"/></xf>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>'

// ─── Лист ────────────────────────────────────────────────────────────────────

interface NormalizedSheet {
  name: string
  columnCount: number
  title?: string
  subtitleLines: string[]
  headerRows: XlsxHeaderCell[][]
  columns: XlsxColumnMeta[]
  rows: XlsxCell[][]
  rowKinds: XlsxRowKind[]
}

const normalizeSheet = (sheet: XlsxSheet): NormalizedSheet => {
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
const computeColumnWidths = (s: NormalizedSheet): number[] => {
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

const buildCellXml = (
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

const buildSheetXml = (s: NormalizedSheet): string => {
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

// --- CRC32 (для ZIP) ---
const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

interface ZipEntry {
  name: string
  data: Uint8Array
}

/** Собирает ZIP-архив методом store (без сжатия). */
const buildZip = (entries: ZipEntry[]): Uint8Array => {
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0

  const u16 = (v: number) => new Uint8Array([v & 0xff, (v >>> 8) & 0xff])
  const u32 = (v: number) =>
    new Uint8Array([
      v & 0xff,
      (v >>> 8) & 0xff,
      (v >>> 16) & 0xff,
      (v >>> 24) & 0xff,
    ])
  const concat = (chunks: Uint8Array[]): Uint8Array => {
    const total = chunks.reduce((sum, c) => sum + c.length, 0)
    const out = new Uint8Array(total)
    let p = 0
    for (const c of chunks) {
      out.set(c, p)
      p += c.length
    }
    return out
  }

  for (const entry of entries) {
    const nameBytes = textEncoder.encode(entry.name)
    const crc = crc32(entry.data)
    const size = entry.data.length

    const localHeader = concat([
      u32(0x04034b50), // local file header signature
      u16(20), // version needed
      u16(0), // flags
      u16(0), // compression: store
      u16(0), // mod time
      u16(0), // mod date
      u32(crc),
      u32(size), // compressed size
      u32(size), // uncompressed size
      u16(nameBytes.length),
      u16(0), // extra field length
      nameBytes,
    ])
    localParts.push(localHeader, entry.data)

    const centralHeader = concat([
      u32(0x02014b50), // central directory header signature
      u16(20), // version made by
      u16(20), // version needed
      u16(0), // flags
      u16(0), // compression
      u16(0), // mod time
      u16(0), // mod date
      u32(crc),
      u32(size),
      u32(size),
      u16(nameBytes.length),
      u16(0), // extra
      u16(0), // comment
      u16(0), // disk number
      u16(0), // internal attrs
      u32(0), // external attrs
      u32(offset), // local header offset
      nameBytes,
    ])
    centralParts.push(centralHeader)

    offset += localHeader.length + entry.data.length
  }

  const centralDir = concat(centralParts)
  const centralOffset = offset
  const endRecord = concat([
    u32(0x06054b50), // end of central dir signature
    u16(0), // disk number
    u16(0), // disk with central dir
    u16(entries.length),
    u16(entries.length),
    u32(centralDir.length),
    u32(centralOffset),
    u16(0), // comment length
  ])

  return concat([...localParts, centralDir, endRecord])
}

/** Формирует Blob готового `.xlsx`-файла с одним листом. */
export const buildXlsxBlob = (sheet: XlsxSheet): Blob => {
  const normalized = normalizeSheet(sheet)

  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '</Types>'

  const rootRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>'

  const workbook =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets><sheet name="${escapeXml(normalized.name)}" sheetId="1" r:id="rId1"/></sheets>` +
    '</workbook>'

  const workbookRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '</Relationships>'

  const entries: ZipEntry[] = [
    { name: '[Content_Types].xml', data: textEncoder.encode(contentTypes) },
    { name: '_rels/.rels', data: textEncoder.encode(rootRels) },
    { name: 'xl/workbook.xml', data: textEncoder.encode(workbook) },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: textEncoder.encode(workbookRels),
    },
    { name: 'xl/styles.xml', data: textEncoder.encode(buildStylesXml()) },
    {
      name: 'xl/worksheets/sheet1.xml',
      data: textEncoder.encode(buildSheetXml(normalized)),
    },
  ]

  return new Blob([buildZip(entries) as unknown as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/** Скачивает Blob как файл в браузере. */
export const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Освобождаем object URL после того, как браузер начал скачивание.
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 0)
}
