import type {
  AnalyticsColumn,
  AnalyticsQueryResult,
} from '@/entities/analytics'
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

const headerLabel = (
  column: AnalyticsColumn | undefined,
  fallback: string,
  isKz: boolean
): string => {
  if (!column) return fallback
  return (isKz ? column.labelKz : column.label) ?? column.label ?? fallback
}

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
  isKz = false
): string => {
  const spec = new Map(columns.map((column) => [column.name, column]))

  const header = result.columns
    .map((column) =>
      escapeCell(headerLabel(spec.get(column.name), column.name, isKz))
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

const sanitizeFileName = (name: string): string =>
  name
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'export'

/** Формирует CSV и отдаёт его на скачивание. */
export const exportReportToCsv = (
  fileName: string,
  columns: AnalyticsColumn[],
  result: AnalyticsQueryResult,
  isKz = false
): void => {
  const blob = new Blob([buildReportCsv(columns, result, isKz)], {
    type: 'text/csv;charset=utf-8',
  })
  downloadBlob(blob, `${sanitizeFileName(fileName)}.csv`)
}
