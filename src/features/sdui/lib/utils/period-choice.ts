import {
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  format,
  isValid,
  parseISO,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subMonths,
  subWeeks,
  subYears,
} from 'date-fns'

export interface PeriodRange {
  from: string
  to: string
}

export type StandardPeriodCode =
  | 'today'
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisQuarter'
  | 'lastQuarter'
  | 'thisHalfYear'
  | 'lastHalfYear'
  | 'thisYear'
  | 'lastYear'
  | 'sinceYearStart'

export const STANDARD_PERIODS: StandardPeriodCode[] = [
  'today',
  'thisWeek',
  'lastWeek',
  'thisMonth',
  'lastMonth',
  'thisQuarter',
  'lastQuarter',
  'thisHalfYear',
  'lastHalfYear',
  'thisYear',
  'lastYear',
  'sinceYearStart',
]

export const EMPTY_PERIOD: PeriodRange = { from: '', to: '' }

const day = (d: Date): string => format(d, 'yyyy-MM-dd')

const range = (from: Date, to: Date): PeriodRange => ({
  from: day(from),
  to: day(to),
})

export const monthPeriod = (year: number, month: number): PeriodRange =>
  range(new Date(year, month, 1), new Date(year, month + 1, 0))

export const quarterPeriod = (year: number, quarter: number): PeriodRange =>
  range(new Date(year, quarter * 3, 1), new Date(year, quarter * 3 + 3, 0))

export const yearPeriod = (year: number): PeriodRange =>
  range(new Date(year, 0, 1), new Date(year, 11, 31))

const halfYearPeriod = (year: number, half: number): PeriodRange =>
  range(new Date(year, half * 6, 1), new Date(year, half * 6 + 6, 0))

const weekOptions = { weekStartsOn: 1 } as const

export function standardPeriod(
  code: StandardPeriodCode,
  today: Date = new Date()
): PeriodRange {
  const year = today.getFullYear()
  const half = today.getMonth() < 6 ? 0 : 1
  switch (code) {
    case 'today':
      return range(today, today)
    case 'thisWeek':
      return range(
        startOfWeek(today, weekOptions),
        endOfWeek(today, weekOptions)
      )
    case 'lastWeek': {
      const d = subWeeks(today, 1)
      return range(startOfWeek(d, weekOptions), endOfWeek(d, weekOptions))
    }
    case 'thisMonth':
      return range(startOfMonth(today), endOfMonth(today))
    case 'lastMonth': {
      const d = subMonths(today, 1)
      return range(startOfMonth(d), endOfMonth(d))
    }
    case 'thisQuarter':
      return range(startOfQuarter(today), endOfQuarter(today))
    case 'lastQuarter': {
      const d = subMonths(today, 3)
      return range(startOfQuarter(d), endOfQuarter(d))
    }
    case 'thisHalfYear':
      return halfYearPeriod(year, half)
    case 'lastHalfYear':
      return half === 0 ? halfYearPeriod(year - 1, 1) : halfYearPeriod(year, 0)
    case 'thisYear':
      return range(startOfYear(today), endOfYear(today))
    case 'lastYear': {
      const d = subYears(today, 1)
      return range(startOfYear(d), endOfYear(d))
    }
    case 'sinceYearStart':
      return range(startOfYear(today), today)
  }
}

export function toDay(raw: string | null | undefined): string {
  if (!raw) return ''
  const d = parseISO(raw)
  return isValid(d) ? day(d) : ''
}

export function normalizePeriod(period: PeriodRange): PeriodRange {
  return { from: toDay(period.from), to: toDay(period.to) }
}

export function unionPeriod(a: PeriodRange, b: PeriodRange): PeriodRange {
  if (!a.from || !a.to) return b
  return {
    from: a.from < b.from ? a.from : b.from,
    to: a.to > b.to ? a.to : b.to,
  }
}

export function isMonthInPeriod(
  period: PeriodRange,
  year: number,
  month: number
): boolean {
  if (!period.from || !period.to) return false
  const m = monthPeriod(year, month)
  return period.from <= m.from && m.to <= period.to
}

export function initialStartYear(
  period: PeriodRange,
  today: Date = new Date()
): number {
  const anchor = period.to || period.from
  const year = anchor ? parseISO(anchor).getFullYear() : today.getFullYear()
  return year - 1
}

export interface PeriodChoiceProps {
  fromNodeId: string
  toNodeId: string
  sourceNodeId: string
}

export function readPeriodChoice(value: unknown): PeriodChoiceProps | null {
  if (value == null || typeof value !== 'object') return null
  const { fromNodeId, toNodeId, sourceNodeId } = value as Record<
    string,
    unknown
  >
  if (
    typeof fromNodeId !== 'string' ||
    typeof toNodeId !== 'string' ||
    typeof sourceNodeId !== 'string'
  ) {
    return null
  }
  return { fromNodeId, toNodeId, sourceNodeId }
}
