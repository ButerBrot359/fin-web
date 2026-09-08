import type {
  AnalyticsColumn,
  AnalyticsQueryColumn,
  AnalyticsValueType,
} from '@/entities/analytics'

import {
  aggregateNumbers,
  columnNumbers,
  findColumnIndex,
} from './build-chart-data'
import {
  asText,
  formatValue,
  parseDateValue,
  toFiniteNumber,
} from './format-value'

/** Строка таблицы: данные, шапка группы или итог (общий/промежуточный). */
export type AnalyticsTableRowKind = 'data' | 'group' | 'total'

export interface AnalyticsTableRow {
  id: string
  kind: AnalyticsTableRowKind
  depth: number
  label?: string
  cells: unknown[]
}

export interface BuildTableModelOptions {
  columns: AnalyticsQueryColumn[]
  rows: unknown[][]
  specColumns?: AnalyticsColumn[]
  groupBy?: string[]
  showTotals?: boolean
  /** Подпись итогов: `analytics.report.total`. */
  totalLabel: string
}

const NUMERIC_TYPES: AnalyticsValueType[] = ['INTEGER', 'DECIMAL']

const isNumericType = (type: AnalyticsValueType): boolean =>
  NUMERIC_TYPES.includes(type)

const compare = (a: unknown, b: unknown, type: AnalyticsValueType): number => {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (isNumericType(type)) {
    return (toFiniteNumber(a) ?? 0) - (toFiniteNumber(b) ?? 0)
  }
  if (type === 'DATE' || type === 'DATETIME') {
    const left = parseDateValue(a)?.getTime() ?? 0
    return left - (parseDateValue(b)?.getTime() ?? 0)
  }
  return asText(a).localeCompare(asText(b), 'ru')
}

/** Сортировка строк результата по колонке; пустые значения всегда внизу. */
export const sortRows = (
  rows: unknown[][],
  index: number,
  desc: boolean,
  type: AnalyticsValueType
): unknown[][] => {
  if (index < 0) return rows
  const sorted = [...rows].sort((a, b) => compare(a[index], b[index], type))
  return desc ? sorted.reverse() : sorted
}

/** Есть ли хоть одна колонка с настроенным итогом. */
export const hasTotals = (specColumns?: AnalyticsColumn[]): boolean =>
  (specColumns ?? []).some((c) => c.total != null && c.total !== 'NONE')

const totalsCells = (
  rows: unknown[][],
  columns: AnalyticsQueryColumn[],
  spec: Map<string, AnalyticsColumn>
): unknown[] =>
  columns.map((column, index) => {
    const total = spec.get(column.name)?.total
    if (!total || total === 'NONE') return null
    return aggregateNumbers(columnNumbers(rows, index), total)
  })

/**
 * Плоская модель строк таблицы: данные, шапки групп по `encoding.groupBy`
 * с промежуточными итогами и общий итог. Всю подготовку делаем один раз —
 * рендер остаётся чистой отрисовкой.
 */
export const buildTableModel = ({
  columns,
  rows,
  specColumns,
  groupBy,
  showTotals = true,
  totalLabel,
}: BuildTableModelOptions): AnalyticsTableRow[] => {
  const spec = new Map((specColumns ?? []).map((c) => [c.name, c]))
  const withTotals = showTotals && hasTotals(specColumns)
  const groupIndexes = (groupBy ?? [])
    .map((field) => findColumnIndex(columns, field))
    .filter((index) => index >= 0)

  const result: AnalyticsTableRow[] = []
  let counter = 0
  const nextId = (prefix: string): string => `${prefix}${String(counter++)}`

  const emit = (level: number, levelRows: unknown[][]): void => {
    if (level >= groupIndexes.length) {
      levelRows.forEach((row) => {
        result.push({ id: nextId('d'), kind: 'data', depth: level, cells: row })
      })
      return
    }

    const groupIndex = groupIndexes[level]
    const format = spec.get(columns[groupIndex].name)?.format
    const buckets = new Map<string, unknown[][]>()
    levelRows.forEach((row) => {
      const key = formatValue(row[groupIndex], format)
      const bucket = buckets.get(key)
      if (bucket) bucket.push(row)
      else buckets.set(key, [row])
    })

    buckets.forEach((bucketRows, key) => {
      result.push({
        id: nextId('g'),
        kind: 'group',
        depth: level,
        label: key,
        cells: [],
      })
      emit(level + 1, bucketRows)
      if (withTotals) {
        result.push({
          id: nextId('s'),
          kind: 'total',
          depth: level + 1,
          label: `${totalLabel} ${key}`,
          cells: totalsCells(bucketRows, columns, spec),
        })
      }
    })
  }

  emit(0, rows)

  if (withTotals && rows.length > 0) {
    result.push({
      id: nextId('t'),
      kind: 'total',
      depth: 0,
      label: totalLabel,
      cells: totalsCells(rows, columns, spec),
    })
  }

  return result
}
