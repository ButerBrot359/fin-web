export type AiStatisticsGroupBy = 'DAY' | 'WEEK' | 'MONTH'
export type AiStatisticsSurface = 'ALL' | 'ASSISTANT' | 'ANALYTICS'

export interface AiStatisticsFilters {
  from: string
  to: string
  groupBy: AiStatisticsGroupBy
  surface: AiStatisticsSurface
}

/** Counts are measured over the complete selected interval, not averaged buckets. */
export interface AiStatisticsMetrics {
  requests: number
  assistantRequests: number
  analyticsRequests: number
  successCount: number
  errorCount: number
  successRate: number | null
  avgLatencyMs: number | null
  p50LatencyMs: number | null
  p95LatencyMs: number | null
  inputTokens: number
  outputTokens: number
  totalTokens: number
  avgTokens: number | null
  estimatedCost: number | null
  avgEstimatedCost: number | null
  pricedRequests: number
  activeUsers: number
  conversations: number
  models: number
  actions: number
}

export interface AiStatisticsBucket {
  bucket: string
  requests: number
  errorCount: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  avgLatencyMs: number | null
  estimatedCost: number | null
}

export interface AiStatisticsModel {
  provider: string
  model: string
  requests: number
  errorCount: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  avgLatencyMs: number | null
  estimatedCost: number | null
}

export interface AiStatistics extends AiStatisticsFilters {
  timezone: string
  currency: string
  metrics: AiStatisticsMetrics
  series: AiStatisticsBucket[]
  byModel: AiStatisticsModel[]
  notes: string[]
  pricingCoveragePercent: number | null
  modelsTruncated: boolean
}
