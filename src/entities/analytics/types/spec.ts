/**
 * Спецификация дашборда или отчёта — зеркало kz.asiaservis.analytics.spec.
 *
 * Это единственное, что создаёт ИИ-ассистент: кода он не пишет и не меняет.
 * Весь рендер — интерпретация этой структуры, всё исполнение — интерпретация
 * datasets[].sql бэкендом под guardrails.
 */

export type AnalyticsItemKind = 'DASHBOARD' | 'REPORT'

export type AnalyticsWidgetType =
  | 'KPI'
  | 'LINE'
  | 'AREA'
  | 'BAR'
  | 'BAR_HORIZONTAL'
  | 'PIE'
  | 'DONUT'
  | 'TABLE'
  | 'PIVOT'
  | 'TEXT'

export type AnalyticsValueType =
  | 'STRING'
  | 'INTEGER'
  | 'DECIMAL'
  | 'BOOLEAN'
  | 'DATE'
  | 'DATETIME'

export type AnalyticsValueFormat =
  | 'PLAIN'
  | 'MONEY'
  | 'INTEGER'
  | 'DECIMAL2'
  | 'PERCENT'
  | 'DATE'
  | 'DATETIME'

export type AnalyticsParameterType =
  | 'STRING'
  | 'INTEGER'
  | 'DECIMAL'
  | 'BOOLEAN'
  | 'DATE'
  | 'DATE_RANGE'
  | 'ENUM'
  | 'DICTIONARY_REF'

export type AnalyticsAggregate =
  | 'NONE'
  | 'SUM'
  | 'AVG'
  | 'MIN'
  | 'MAX'
  | 'COUNT'

/** Ссылка на колонку датасета в слоте виджета. */
export interface AnalyticsFieldRef {
  field: string
  label?: string | null
  labelKz?: string | null
  format?: AnalyticsValueFormat | null
  aggregate?: AnalyticsAggregate
}

export interface AnalyticsSort {
  field: string
  direction: 'ASC' | 'DESC'
}

/** Колонка датасета: контракт между SQL и виджетами. */
export interface AnalyticsColumn {
  name: string
  label?: string | null
  labelKz?: string | null
  type: AnalyticsValueType
  format: AnalyticsValueFormat
  total?: AnalyticsAggregate
}

export interface AnalyticsAllowedValue {
  value: unknown
  label?: string | null
  labelKz?: string | null
}

/**
 * Параметр, задаваемый пользователем. defaultValue поддерживает макросы,
 * которые раскрывает клиент: @today, @startOfMonth, @endOfMonth, @startOfYear,
 * @endOfYear, @startOfPrevYear, @endOfPrevYear.
 *
 * DATE_RANGE раскрывается в пару плейсхолдеров :{code}_from и :{code}_to.
 */
export interface AnalyticsParameter {
  code: string
  label?: string | null
  labelKz?: string | null
  type: AnalyticsParameterType
  required: boolean
  defaultValue?: unknown
  allowedValues?: AnalyticsAllowedValue[]
  referenceTypeCode?: string | null
}

/**
 * Датасет — один SQL и описание его колонок. sqlHash считает бэкенд при
 * генерации; при выполнении отправляем оба поля, расхождение даёт 409.
 */
export interface AnalyticsDataset {
  id: string
  sql: string
  sqlHash: string
  parameters: string[]
  columns: AnalyticsColumn[]
}

export interface AnalyticsWidgetPosition {
  x: number
  y: number
  w: number
  h: number
}

export interface AnalyticsLayout {
  columns: number
  rowHeight: number
}

/**
 * Привязка колонок датасета к слотам виджета. Один объект на все виды: каждый
 * вид использует своё подмножество слотов, обязательность задаёт реестр видов
 * на бэкенде (GET /api/analytics/widget-kinds).
 */
export interface AnalyticsEncoding {
  value?: AnalyticsFieldRef | null
  delta?: AnalyticsFieldRef | null
  label?: AnalyticsFieldRef | null
  x?: AnalyticsFieldRef | null
  y?: AnalyticsFieldRef[]
  series?: AnalyticsFieldRef | null
  stacked?: boolean
  columns?: AnalyticsFieldRef[]
  groupBy?: string[]
  sort?: AnalyticsSort[]
  markdown?: string | null
}

/**
 * Виджет дашборда. effectiveType заполняет бэкенд, когда заменяет вид:
 * например, PIE со знаковой мерой рисуется как BAR, иначе круговая диаграмма
 * выходит пустой без единой ошибки. Рисуем effectiveType ?? type.
 */
export interface AnalyticsWidget {
  id: string
  type: AnalyticsWidgetType
  title?: string | null
  titleKz?: string | null
  datasetId?: string | null
  position: AnalyticsWidgetPosition
  encoding: AnalyticsEncoding
  effectiveType?: AnalyticsWidgetType | null
  effectiveTypeReason?: string | null
  options?: Record<string, unknown>
}

export interface AnalyticsSpec {
  specVersion: number
  kind: AnalyticsItemKind
  title?: string | null
  titleKz?: string | null
  description?: string | null
  parameters: AnalyticsParameter[]
  datasets: AnalyticsDataset[]
  layout: AnalyticsLayout
  widgets: AnalyticsWidget[]
  sourceViews?: string[]
}
