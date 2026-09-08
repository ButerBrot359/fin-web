/** Выполнение датасета — зеркало kz.asiaservis.analytics.query. */

import type { AnalyticsValueType } from './spec'

export interface AnalyticsQueryColumn {
  name: string
  type: AnalyticsValueType
  sqlType?: string | null
}

/**
 * Результат запроса. rows — массив массивов, порядок значений задан columns:
 * при десятках тысяч строк это заметно компактнее списка объектов.
 *
 * Эти данные идут БД → бэкенд → фронт и в LLM не попадают никогда.
 */
export interface AnalyticsQueryResult {
  columns: AnalyticsQueryColumn[]
  rows: unknown[][]
  rowCount: number
  truncated: boolean
  executionMs: number
  sqlHash?: string | null
}

export interface AnalyticsQueryRequest {
  sql: string
  sqlHash: string
  parameters: Record<string, unknown>
  organizationId?: number | null
  maxRows?: number | null
}

/** Отчёт guardrails по запросу: что именно не понравилось и почему. */
export interface AnalyticsSqlValidation {
  valid: boolean
  normalizedSql?: string | null
  tables: string[]
  parameters: string[]
  violations: string[]
  planCost?: number | null
}
