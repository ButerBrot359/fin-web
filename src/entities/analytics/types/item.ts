/** Сохранённые дашборды и отчёты, каталог витрин, реестр видов виджетов. */

import type {
  AnalyticsItemKind,
  AnalyticsSpec,
  AnalyticsWidgetType,
} from './spec'

export interface AnalyticsItemSummary {
  code: string
  kind: AnalyticsItemKind
  titleRu: string
  titleKz?: string | null
  description?: string | null
  tags?: string | null
  isFavorite: boolean
  updatedAt?: string | null
}

export interface AnalyticsItem extends AnalyticsItemSummary {
  spec: AnalyticsSpec
  specVersion: number
}

export interface AnalyticsItemSaveRequest {
  /** Пусто при создании — бэкенд сгенерирует код из заголовка. */
  code?: string | null
  kind: AnalyticsItemKind
  titleRu: string
  titleKz?: string | null
  description?: string | null
  tags?: string | null
  spec: AnalyticsSpec
  /** Промпт, породивший версию — попадает в историю версий. */
  prompt?: string | null
}

/** Строка индекса витрин: то, по чему ассистент выбирает источники данных. */
export interface AnalyticsCatalogIndexItem {
  viewName: string
  domainKind: string
  typeCode: string
  titleRu: string
  titleKz?: string | null
  tags?: string | null
  rowEstimate: number
  columnCount: number
}

export interface AnalyticsCatalogColumn {
  name: string
  sqlType?: string | null
  titleRu?: string | null
  titleKz?: string | null
  description?: string | null
  role: string
  referenceDomainKind?: string | null
  referenceTypeCode?: string | null
  sampleValues: string[]
}

export interface AnalyticsCatalogView {
  viewName: string
  domainKind: string
  typeCode: string
  titleRu: string
  titleKz?: string | null
  description?: string | null
  orgFiltered: boolean
  tags?: string | null
  rowEstimate: number
  columns: AnalyticsCatalogColumn[]
}

/**
 * Описание вида виджета из реестра на бэкенде. Фронт не решает сам, какие слоты
 * обязательны и когда деградировать вид — он читает это отсюда.
 */
export interface AnalyticsWidgetKind {
  type: AnalyticsWidgetType
  titleRu: string
  titleKz?: string | null
  /** Слоты encoding: value, x, y, label, series, columns, markdown. */
  requiredSlots: string[]
  optionalSlots: string[]
  /** Нужен ли виджету датасет (у TEXT — нет). */
  requiresDataset: boolean
  /** Считать ли нулевой результат валидным ответом (у KPI — да). */
  zeroIsValid: boolean
}
