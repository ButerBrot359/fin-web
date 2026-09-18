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
 *
 * Модуль разложен по частям: `zip.ts` (контейнер), `xlsx-styles.ts`
 * (styles.xml), `sheet-xml.ts` (лист); здесь — сборка пакета и публичный API.
 */
import { buildZip, type ZipEntry } from './zip'
import { buildStylesXml } from './xlsx-styles'
import {
  buildSheetXml,
  escapeXml,
  normalizeSheet,
  type XlsxSheet,
} from './sheet-xml'

export type {
  XlsxCell,
  XlsxColumnMeta,
  XlsxHeaderCell,
  XlsxRowKind,
  XlsxSheet,
} from './sheet-xml'

const textEncoder = new TextEncoder()

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
