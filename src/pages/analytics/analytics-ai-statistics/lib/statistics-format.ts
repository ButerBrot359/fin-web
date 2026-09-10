import type { AiStatisticsMetrics } from '@/entities/analytics'

export type MetricUnit = 'count' | 'percent' | 'latency' | 'cost' | 'average'
export const STATISTICS_METRICS: {
  key: keyof AiStatisticsMetrics
  unit: MetricUnit
}[] = [
  { key: 'requests', unit: 'count' },
  { key: 'avgLatencyMs', unit: 'latency' },
  { key: 'avgTokens', unit: 'average' },
  { key: 'avgEstimatedCost', unit: 'cost' },
  { key: 'successRate', unit: 'percent' },
  { key: 'totalTokens', unit: 'count' },
  { key: 'estimatedCost', unit: 'cost' },
  { key: 'assistantRequests', unit: 'count' },
  { key: 'analyticsRequests', unit: 'count' },
  { key: 'successCount', unit: 'count' },
  { key: 'errorCount', unit: 'count' },
  { key: 'p50LatencyMs', unit: 'latency' },
  { key: 'p95LatencyMs', unit: 'latency' },
  { key: 'inputTokens', unit: 'count' },
  { key: 'outputTokens', unit: 'count' },
  { key: 'pricedRequests', unit: 'count' },
  { key: 'activeUsers', unit: 'count' },
  { key: 'conversations', unit: 'count' },
  { key: 'models', unit: 'count' },
  { key: 'actions', unit: 'count' },
]

export function formatStatistic(
  value: number | null,
  unit: MetricUnit,
  locale: string
): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const display = unit === 'latency' ? value / 1000 : value
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits:
      unit === 'cost' ? 6 : unit === 'latency' ? 2 : unit === 'count' ? 0 : 1,
  }).format(display)
}

export function localDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

export function recentPeriod(
  days: number,
  now = new Date()
): { from: string; to: string } {
  const from = new Date(now)
  from.setDate(from.getDate() - days + 1)
  return { from: localDate(from), to: localDate(now) }
}

/** Date-only bucket identifiers represent calendar dates, not UTC instants. */
export function formatBucket(
  bucket: string,
  locale: string,
  monthly = false
): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(bucket)
  if (!match) return bucket
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    12
  )
  return new Intl.DateTimeFormat(
    locale,
    monthly
      ? { month: 'short', year: '2-digit' }
      : { day: 'numeric', month: 'short' }
  ).format(date)
}

export function isValidStatisticsPeriod(from: string, to: string): boolean {
  const valid = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  if (!valid(from) || !valid(to)) return false
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1
  return days >= 1 && days <= 366
}
