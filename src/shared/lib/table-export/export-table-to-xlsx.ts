import { buildXlsxBlob, downloadBlob } from '@/shared/lib/xlsx/write-xlsx'

import type { TableExportData } from './extract-table-export'

const sanitizeFileName = (name: string): string =>
  name
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'export'

/**
 * Формирует `.xlsx` из подготовленных данных и инициирует скачивание.
 * Имя листа и файла — из `sheetName` (имя таблицы/страницы).
 */
export const exportTableToXlsx = (
  sheetName: string,
  data: TableExportData
): void => {
  const blob = buildXlsxBlob({
    name: sheetName,
    headers: data.headers,
    rows: data.rows,
    title: data.title,
    subtitleLines: data.subtitleLines,
    headerRows: data.headerRows,
    columns: data.columns,
    rowKinds: data.rowKinds,
  })
  downloadBlob(blob, `${sanitizeFileName(sheetName)}.xlsx`)
}
