import { describe, expect, it } from 'vitest'
import {
  formatStatistic,
  isValidStatisticsPeriod,
  recentPeriod,
  STATISTICS_METRICS,
} from './statistics-format'
import { getStatisticsCopy, statisticsLocale } from './statistics-copy'
import { formatStatisticsNote } from './statistics-notes'

describe('AI statistics presentation', () => {
  it('contains exactly twenty distinct metrics with the requested averages first', () => {
    expect(STATISTICS_METRICS).toHaveLength(20)
    expect(new Set(STATISTICS_METRICS.map((m) => m.key)).size).toBe(20)
    expect(STATISTICS_METRICS.slice(0, 4).map((m) => m.key)).toEqual([
      'requests',
      'avgLatencyMs',
      'avgTokens',
      'avgEstimatedCost',
    ])
  })
  it('distinguishes unknown costs from free requests and preserves small estimates', () => {
    expect(formatStatistic(null, 'cost', 'ru-RU')).toBe('—')
    expect(formatStatistic(0, 'cost', 'ru-RU')).toBe('0')
    expect(formatStatistic(0.000025, 'cost', 'ru-RU')).toBe('0,000025')
    expect(formatStatistic(1500, 'latency', 'ru-RU')).toBe('1,5')
    expect(formatStatistic(95.5, 'percent', 'ru-RU')).toBe('95,5')
  })
  it('uses inclusive local calendar periods and validates real dates and the API limit', () => {
    expect(recentPeriod(30, new Date(2026, 8, 10, 23))).toEqual({
      from: '2026-08-12',
      to: '2026-09-10',
    })
    expect(isValidStatisticsPeriod('2024-01-01', '2024-12-31')).toBe(true)
    expect(isValidStatisticsPeriod('2024-01-01', '2025-01-01')).toBe(false)
    expect(isValidStatisticsPeriod('2026-02-30', '2026-03-10')).toBe(false)
    expect(isValidStatisticsPeriod('2026-09-10', '2026-09-09')).toBe(false)
  })
  it('provides Kazakh metric labels and localized caveats without exposing protocol codes', () => {
    expect(statisticsLocale('kk-KZ')).toBe('kk-KZ')
    expect(getStatisticsCopy('kz').title).toBe('ЖИ статистикасы')
    for (const { key } of STATISTICS_METRICS)
      expect(getStatisticsCopy('kz').metrics[key][0]).toBeTruthy()
    expect(formatStatisticsNote('TOKEN_USAGE_INCOMPLETE', 'ru')).toContain(
      'неизвестен'
    )
    expect(formatStatisticsNote('UNKNOWN_FUTURE_CODE', 'ru')).toBeNull()
  })
})
