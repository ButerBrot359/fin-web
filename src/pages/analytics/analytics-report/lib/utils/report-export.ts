import type {
  AnalyticsColumn,
  AnalyticsQueryResult,
} from '@/entities/analytics'
import { pickLabel } from '@/entities/analytics'
import { buildExportData, formatValue } from '@/features/analytics-widgets'
import { exportTableToXlsx } from '@/shared/lib/table-export'
import { downloadBlob } from '@/shared/lib/xlsx/write-xlsx'

/** Выгрузка результата отчёта в `.xlsx` через общий писатель проекта. */
export const exportReportToXlsx = (
  sheetName: string,
  columns: AnalyticsColumn[],
  result: AnalyticsQueryResult,
  lang?: string | null
): void => {
  const data = buildExportData(
    result.columns,
    result.rows,
    columns,
    sheetName,
    lang
  )
  exportTableToXlsx(sheetName, data)
}

/** BOM в начале файла: без него Excel открывает CSV в ANSI. */
const CSV_BOM = '\uFEFF'

/** Экранирование ячейки CSV: кавычки удваиваем, спецсимволы — в кавычки. */
const escapeCell = (value: string): string =>
  /[";\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value

/**
 * CSV для русской локали: разделитель `;` и BOM в начале — без BOM Excel
 * открывает файл в ANSI и кириллица превращается в кракозябры.
 *
 * Порядок значений в строке задают `result.columns`; колонки спецификации
 * дают подпись и формат и сопоставляются по имени (как в `buildExportData`).
 */
export const buildReportCsv = (
  columns: AnalyticsColumn[],
  result: AnalyticsQueryResult,
  lang?: string | null
): string => {
  const spec = new Map(columns.map((column) => [column.name, column]))

  const header = result.columns
    .map((column) =>
      escapeCell(pickLabel(spec.get(column.name), column.name, lang))
    )
    .join(';')

  const lines = result.rows.map((row) =>
    result.columns
      .map((column, index) =>
        escapeCell(formatValue(row[index], spec.get(column.name)?.format))
      )
      .join(';')
  )

  return CSV_BOM + [header, ...lines].join('\r\n')
}

export const sanitizeFileName = (name: string): string =>
  name
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'export'

/** Формирует CSV и отдаёт его на скачивание. */
export const exportReportToCsv = (
  fileName: string,
  columns: AnalyticsColumn[],
  result: AnalyticsQueryResult,
  lang?: string | null
): void => {
  const blob = new Blob([buildReportCsv(columns, result, lang)], {
    type: 'text/csv;charset=utf-8',
  })
  downloadBlob(blob, `${sanitizeFileName(fileName)}.csv`)
}
