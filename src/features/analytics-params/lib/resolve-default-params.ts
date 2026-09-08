import {
  endOfMonth,
  endOfYear,
  format,
  isValid,
  parseISO,
  startOfMonth,
  startOfYear,
  subYears,
} from 'date-fns'

import type { AnalyticsParameter } from '@/entities/analytics'

import type {
  AnalyticsDateRangeValue,
  AnalyticsParamValues,
} from '../types/params'

/** Формат, в котором даты уходят на бэкенд и хранятся в значениях панели. */
export const ISO_DATE = 'yyyy-MM-dd'

/** Макросы `defaultValue`, которые раскрывает клиент. */
const MACROS = new Map<string, (now: Date) => Date>([
  ['@today', (now) => now],
  ['@startOfMonth', (now) => startOfMonth(now)],
  ['@endOfMonth', (now) => endOfMonth(now)],
  ['@startOfYear', (now) => startOfYear(now)],
  ['@endOfYear', (now) => endOfYear(now)],
  ['@startOfPrevYear', (now) => startOfYear(subYears(now, 1))],
  ['@endOfPrevYear', (now) => endOfYear(subYears(now, 1))],
])

/** Дата в `yyyy-MM-dd`; всё, что не разбирается как дата, даёт null. */
export const toIsoDate = (value: unknown): string | null => {
  if (value == null || value === '') return null
  if (value instanceof Date)
    return isValid(value) ? format(value, ISO_DATE) : null
  if (typeof value !== 'string') return null
  const parsed = parseISO(value)
  return isValid(parsed) ? format(parsed, ISO_DATE) : null
}

/** Раскрывает макрос в дату; значение-не-макрос возвращается как есть. */
export const resolveMacro = (value: unknown, now = new Date()): unknown => {
  if (typeof value !== 'string' || !value.startsWith('@')) return value
  const macro = MACROS.get(value)
  return macro ? format(macro(now), ISO_DATE) : value
}

/** Приводит `defaultValue` любого вида к паре дат периода. */
export const toDateRange = (
  value: unknown,
  now?: Date
): AnalyticsDateRangeValue => {
  if (Array.isArray(value)) {
    const [from, to] = value as unknown[]
    return {
      from: toIsoDate(resolveMacro(from, now)),
      to: toIsoDate(resolveMacro(to, now)),
    }
  }
  if (value != null && typeof value === 'object') {
    const raw = value as { from?: unknown; to?: unknown }
    return {
      from: toIsoDate(resolveMacro(raw.from, now)),
      to: toIsoDate(resolveMacro(raw.to, now)),
    }
  }
  return { from: toIsoDate(resolveMacro(value, now)), to: null }
}

const resolveOne = (parameter: AnalyticsParameter, now: Date): unknown => {
  if (parameter.type === 'DATE_RANGE') {
    return toDateRange(parameter.defaultValue, now)
  }
  const resolved = resolveMacro(parameter.defaultValue, now)
  if (resolved == null) return parameter.type === 'BOOLEAN' ? false : null
  if (parameter.type === 'DATE') return toIsoDate(resolved)
  if (parameter.type === 'BOOLEAN') return Boolean(resolved)
  return resolved
}

/**
 * Начальные значения параметров: раскрывает макросы `defaultValue`
 * (`@today`, `@startOfMonth`, `@endOfMonth`, `@startOfYear`, `@endOfYear`,
 * `@startOfPrevYear`, `@endOfPrevYear`), остальное отдаёт как есть.
 */
export const resolveDefaultParams = (
  parameters: AnalyticsParameter[],
  now = new Date()
): AnalyticsParamValues => {
  const values: AnalyticsParamValues = {}
  parameters.forEach((parameter) => {
    values[parameter.code] = resolveOne(parameter, now)
  })
  return values
}
