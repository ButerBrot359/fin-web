/**
 * Минимальный генератор настоящего `.xlsx` (OOXML) без сторонних зависимостей.
 *
 * Зачем свой: npm-пакеты `xlsx`/`exceljs` тянут известные уязвимости в путь
 * ЧТЕНИЯ файлов (нам не нужный) и засоряют `npm audit`. Здесь только ЗАПИСЬ:
 * формируем ZIP-архив (метод store, без сжатия) с обязательными XML-частями.
 * Excel открывает такой файл нативно, без предупреждения о несоответствии
 * формата и расширения (в отличие от трюка «HTML-таблица с расширением .xls»).
 */

/** Значение ячейки: строка (inlineStr) или число (числовая ячейка). */
export type XlsxCell = string | number | null | undefined

export interface XlsxSheet {
  /** Имя листа (Excel ограничивает 31 символом, запрещает : \ / ? * [ ]). */
  name: string
  /** Заголовки колонок (первая строка). */
  headers: string[]
  /** Строки данных. */
  rows: XlsxCell[][]
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

const buildCell = (cell: XlsxCell, colIndex: number, rowIndex: number): string => {
  const ref = `${columnLetter(colIndex)}${String(rowIndex + 1)}`
  if (cell == null || cell === '') return ''
  if (typeof cell === 'number' && Number.isFinite(cell)) {
    return `<c r="${ref}"><v>${String(cell)}</v></c>`
  }
  const text = escapeXml(String(cell))
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`
}

const buildSheetXml = (sheet: XlsxSheet): string => {
  const allRows = [sheet.headers, ...sheet.rows]
  const rowsXml = allRows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, colIndex) => buildCell(cell, colIndex, rowIndex))
        .join('')
      return `<row r="${String(rowIndex + 1)}">${cells}</row>`
    })
    .join('')
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetData>${rowsXml}</sheetData>` +
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
  const sheetName = sanitizeSheetName(sheet.name)

  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
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
    `<sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets>` +
    '</workbook>'

  const workbookRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    '</Relationships>'

  const entries: ZipEntry[] = [
    { name: '[Content_Types].xml', data: textEncoder.encode(contentTypes) },
    { name: '_rels/.rels', data: textEncoder.encode(rootRels) },
    { name: 'xl/workbook.xml', data: textEncoder.encode(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: textEncoder.encode(workbookRels) },
    {
      name: 'xl/worksheets/sheet1.xml',
      data: textEncoder.encode(buildSheetXml({ ...sheet, name: sheetName })),
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
