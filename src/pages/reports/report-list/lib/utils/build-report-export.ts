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

/** Числовое (MEASURE) значение — формат с разрядами пробелами, как в таблице. */
const formatCell = (value: unknown, col: ReportColumnDto): string | number => {
  if (value == null || value === '') return ''
  if (col.role === 'MEASURE') {
    const n = typeof value === 'number' ? value : Number(value)
    if (!Number.isNaN(n)) return formatWithSpaces(String(n))
  }
  if (typeof value === 'string' || typeof value === 'number') return value
  return ''
}

/**
 * Готовит данные результата отчёта для выгрузки в Excel. Первая колонка —
 * наименование группы (с отступом по уровню, как в таблице); остальные — видимые
 * колонки результата. Дерево `rows` обходится в глубину. Скрытые настройками
 * колонки исключаются (передаются уже отфильтрованные `columns`).
 */
export const buildReportExport = (
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
      const indent = '  '.repeat(row.level)
      out.push([
        `${indent}${row.groupValue ?? ''}`,
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
