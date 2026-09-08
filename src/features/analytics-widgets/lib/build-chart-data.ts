import type {
  AnalyticsAggregate,
  AnalyticsColumn,
  AnalyticsEncoding,
  AnalyticsFieldRef,
  AnalyticsQueryColumn,
  AnalyticsQueryResult,
  AnalyticsValueFormat,
} from '@/entities/analytics'

import { colorAt } from './chart-colors'
import { formatValue, pickLabel, toFiniteNumber } from './format-value'

/** Ключ оси X в датасете `@mui/x-charts`. */
export const X_KEY = 'x'

/** Потолок серий при разбиении по `encoding.series`: больше — нечитаемо. */
const MAX_SPLIT_SERIES = 12

export type ChartDatasetRow = Record<string, string | number | null>

export interface ChartSeries {
  dataKey: string
  label: string
  color: string
  stack?: string
  format?: AnalyticsValueFormat | null
}

export interface CartesianChartData {
  dataset: ChartDatasetRow[]
  series: ChartSeries[]
}

export interface PieSlice {
  id: string
  value: number
  label: string
  color: string
}

export interface BuildChartOptions {
  result: AnalyticsQueryResult
  encoding: AnalyticsEncoding
  specColumns?: AnalyticsColumn[]
  lang?: string | null
}

/** Индекс колонки датасета по имени поля; -1 — поля нет в результате. */
export const findColumnIndex = (
  columns: AnalyticsQueryColumn[],
  field?: string | null
): number => (field ? columns.findIndex((c) => c.name === field) : -1)

/** Колонки спецификации по имени: форматы, подписи и итоги. */
export const buildSpecMap = (
  specColumns?: AnalyticsColumn[]
): Map<string, AnalyticsColumn> =>
  new Map((specColumns ?? []).map((c) => [c.name, c]))

/** Формат слота: приоритет у ссылки, иначе формат колонки датасета. */
export const resolveFormat = (
  ref: AnalyticsFieldRef | null | undefined,
  spec: Map<string, AnalyticsColumn>
): AnalyticsValueFormat | null => {
  if (ref?.format) return ref.format
  const column = ref?.field ? spec.get(ref.field) : undefined
  return column?.format ?? null
}

/** Свёртка ряда чисел; NONE — первое непустое значение. */
export const aggregateNumbers = (
  values: (number | null)[],
  aggregate?: AnalyticsAggregate
): number | null => {
  const numbers = values.filter((v): v is number => v != null)
  if (aggregate === 'COUNT') return numbers.length
  if (numbers.length === 0) return null
  switch (aggregate) {
    case 'SUM':
      return numbers.reduce((acc, v) => acc + v, 0)
    case 'AVG':
      return numbers.reduce((acc, v) => acc + v, 0) / numbers.length
    case 'MIN':
      return Math.min(...numbers)
    case 'MAX':
      return Math.max(...numbers)
    default:
      return numbers[0]
  }
}

/** Колонка результата как ряд чисел (строки PostgreSQL numeric разбираются). */
export const columnNumbers = (
  rows: unknown[][],
  index: number
): (number | null)[] =>
  index < 0 ? [] : rows.map((row) => toFiniteNumber(row[index]))

const axisLabels = (
  result: AnalyticsQueryResult,
  encoding: AnalyticsEncoding,
  spec: Map<string, AnalyticsColumn>
): string[] => {
  const index = findColumnIndex(result.columns, encoding.x?.field)
  if (index < 0) return result.rows.map((_, i) => String(i + 1))
  const format = resolveFormat(encoding.x, spec)
  return result.rows.map((row) => formatValue(row[index], format))
}

/** Каждая мера `encoding.y[]` — отдельная серия. */
const buildMeasureSeries = (
  { result, encoding, lang }: BuildChartOptions,
  spec: Map<string, AnalyticsColumn>,
  labels: string[]
): CartesianChartData => {
  const refs = encoding.y ?? []
  const stack = encoding.stacked ? 'total' : undefined
  const indexes = refs.map((ref) => findColumnIndex(result.columns, ref.field))

  const dataset = result.rows.map((row, rowIndex) => {
    const item: ChartDatasetRow = { [X_KEY]: labels[rowIndex] }
    indexes.forEach((columnIndex, i) => {
      item[`s${String(i)}`] =
        columnIndex < 0 ? null : toFiniteNumber(row[columnIndex])
    })
    return item
  })

  const series = refs.map((ref, i) => ({
    dataKey: `s${String(i)}`,
    label: pickLabel(ref, ref.field, lang),
    color: colorAt(i),
    stack,
    format: resolveFormat(ref, spec),
  }))

  return { dataset, series }
}

/** Одна мера, развёрнутая в серии по значениям `encoding.series`. */
const buildSplitSeries = (
  { result, encoding }: BuildChartOptions,
  spec: Map<string, AnalyticsColumn>,
  labels: string[],
  splitIndex: number
): CartesianChartData => {
  const measure = encoding.y?.[0]
  const valueIndex = findColumnIndex(result.columns, measure?.field)
  const splitFormat = resolveFormat(encoding.series, spec)
  const stack = encoding.stacked ? 'total' : undefined

  const byLabel = new Map<string, ChartDatasetRow>()
  const dataset: ChartDatasetRow[] = []
  const splitValues: string[] = []

  result.rows.forEach((row, rowIndex) => {
    const label = labels[rowIndex]
    let item = byLabel.get(label)
    if (!item) {
      item = { [X_KEY]: label }
      byLabel.set(label, item)
      dataset.push(item)
    }
    const splitLabel = formatValue(row[splitIndex], splitFormat)
    let seriesIndex = splitValues.indexOf(splitLabel)
    if (seriesIndex < 0) {
      if (splitValues.length >= MAX_SPLIT_SERIES) return
      splitValues.push(splitLabel)
      seriesIndex = splitValues.length - 1
    }
    item[`s${String(seriesIndex)}`] =
      valueIndex < 0 ? null : toFiniteNumber(row[valueIndex])
  })

  // Пропуски — именно null: в графике это разрыв линии, а не ноль.
  dataset.forEach((item) => {
    splitValues.forEach((_, i) => {
      const key = `s${String(i)}`
      if (!(key in item)) item[key] = null
    })
  })

  const format = resolveFormat(measure, spec)
  const series = splitValues.map((label, i) => ({
    dataKey: `s${String(i)}`,
    label,
    color: colorAt(i),
    stack,
    format,
  }))

  return { dataset, series }
}

/** Датасет и серии для LINE/AREA/BAR/BAR_HORIZONTAL. */
export const buildCartesianData = (
  options: BuildChartOptions
): CartesianChartData => {
  const spec = buildSpecMap(options.specColumns)
  const labels = axisLabels(options.result, options.encoding, spec)
  const splitIndex = findColumnIndex(
    options.result.columns,
    options.encoding.series?.field
  )
  return splitIndex >= 0 && options.encoding.y?.length
    ? buildSplitSeries(options, spec, labels, splitIndex)
    : buildMeasureSeries(options, spec, labels)
}

interface PieItem {
  label: string
  value: number
}

const toSlice = (item: PieItem, index: number): PieSlice => ({
  id: `p${String(index)}`,
  value: item.value,
  label: item.label,
  color: colorAt(index),
})

/**
 * Секторы круговой диаграммы. Хвост длиннее `maxSlices` сворачивается в один
 * сектор с подписью `otherLabel` — иначе легенда превращается в простыню.
 */
export const buildPieData = (
  options: BuildChartOptions,
  maxSlices = 15,
  otherLabel = '…'
): PieSlice[] => {
  const { result, encoding } = options
  const spec = buildSpecMap(options.specColumns)
  const labelIndex = findColumnIndex(result.columns, encoding.label?.field)
  const valueIndex = findColumnIndex(result.columns, encoding.value?.field)
  if (valueIndex < 0) return []

  const labelFormat = resolveFormat(encoding.label, spec)
  const items = result.rows
    .map((row, i) => ({
      label:
        labelIndex < 0
          ? String(i + 1)
          : formatValue(row[labelIndex], labelFormat),
      value: toFiniteNumber(row[valueIndex]),
    }))
    .filter((item): item is PieItem => item.value != null)

  if (items.length <= maxSlices) return items.map(toSlice)

  const sorted = [...items].sort(
    (a, b) => Math.abs(b.value) - Math.abs(a.value)
  )
  const tail = sorted.slice(maxSlices - 1)
  const other: PieItem = {
    label: `${otherLabel} (${String(tail.length)})`,
    value: tail.reduce((acc, item) => acc + item.value, 0),
  }
  return [...sorted.slice(0, maxSlices - 1), other].map(toSlice)
}
