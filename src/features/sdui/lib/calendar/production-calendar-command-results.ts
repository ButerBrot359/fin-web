// SCRUM-277 §13.2: рантайм-гарды commandResult производственного календаря.
// Проводу не доверяем: невалидный payload → null (+ warn в dev), а не падение
// всего SDUI-дерева. Фронт показатели НЕ пересчитывает — только валидирует
// структуру и внутреннюю согласованность.

import type { ProductionCalendarNodeProps } from './production-calendar-types'

export interface ProductionCalendarPrintIndicators {
  calendarDays: number
  workingDays: number
  daysOff: number
  hours40: number
  hours36: number
  hours24: number
}

export interface ProductionCalendarPrintPeriod {
  number: number
  indicators: ProductionCalendarPrintIndicators
}

export interface ProductionCalendarPrintProjection {
  revisionId: number
  headVersion: number
  calendarYear: number
  coverage: 'FULL' | 'PARTIAL'
  sourceSha256: string
  months: ProductionCalendarPrintPeriod[]
  quarters: ProductionCalendarPrintPeriod[]
  halfYears: ProductionCalendarPrintPeriod[]
  annual: ProductionCalendarPrintIndicators
  averageMonthly: {
    hours40: number
    hours36: number
    hours24: number
  }
  nonWorkingPeriodWarning: false
}

/** Отражение base-состояния в commandResult BASE_*-исходов. Источник правды
 *  для UI — props узла; view нужен только как типизированный доступ к result. */
export interface ProductionCalendarBaseSelectionView {
  hasBaseCalendar: boolean
  baseCalendarEntryId: number | null
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v != null && !Array.isArray(v)

const isFiniteNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v)

const nonNegative = (v: unknown): v is number => isFiniteNumber(v) && v >= 0

function readIndicators(v: unknown): ProductionCalendarPrintIndicators | null {
  if (!isRecord(v)) return null
  const { calendarDays, workingDays, daysOff, hours40, hours36, hours24 } = v
  if (
    !nonNegative(calendarDays) ||
    !nonNegative(workingDays) ||
    !nonNegative(daysOff) ||
    !nonNegative(hours40) ||
    !nonNegative(hours36) ||
    !nonNegative(hours24)
  ) {
    return null
  }
  // Согласованность проекции (§13.2): дни календаря = рабочие + выходные
  if (calendarDays !== workingDays + daysOff) return null
  return { calendarDays, workingDays, daysOff, hours40, hours36, hours24 }
}

function readPeriods(
  v: unknown,
  maxNumber: number
): ProductionCalendarPrintPeriod[] | null {
  if (!Array.isArray(v)) return null
  const out: ProductionCalendarPrintPeriod[] = []
  for (const item of v) {
    if (!isRecord(item)) return null
    const number = item.number
    if (!isFiniteNumber(number) || number < 1 || number > maxNumber) return null
    const indicators = readIndicators(item.indicators)
    if (!indicators) return null
    out.push({ number, indicators })
  }
  return out
}

const warnInvalid = (what: string, payload: unknown) => {
  if (import.meta.env.DEV) {
    console.warn(
      `[sdui] невалидный ${what} производственного календаря`,
      payload
    )
  }
}

/**
 * Валидная печатная проекция ТОЛЬКО при commandOutcome=PRINT_READY и
 * commandResult.status=READY; всё остальное (включая битый провод) → null.
 */
export function readPrintProjection(
  props: ProductionCalendarNodeProps
): ProductionCalendarPrintProjection | null {
  if (props.commandOutcome !== 'PRINT_READY') return null
  const result = props.commandResult
  if (!isRecord(result) || result.status !== 'READY') return null
  const p = result.projection
  if (!isRecord(p)) {
    warnInvalid('print projection', result)
    return null
  }

  const {
    revisionId,
    headVersion,
    calendarYear,
    coverage,
    sourceSha256,
    annual,
    averageMonthly,
    nonWorkingPeriodWarning,
  } = p

  const months = readPeriods(p.months, 12)
  const quarters = readPeriods(p.quarters, 4)
  const halfYears = readPeriods(p.halfYears, 2)
  const annualIndicators = readIndicators(annual)

  const avg = isRecord(averageMonthly) ? averageMonthly : null
  const avgValid =
    avg != null &&
    nonNegative(avg.hours40) &&
    nonNegative(avg.hours36) &&
    nonNegative(avg.hours24)

  const valid =
    isFiniteNumber(revisionId) &&
    revisionId > 0 &&
    nonNegative(headVersion) &&
    isFiniteNumber(calendarYear) &&
    calendarYear >= 1900 &&
    calendarYear <= 2200 &&
    (coverage === 'FULL' || coverage === 'PARTIAL') &&
    typeof sourceSha256 === 'string' &&
    months != null &&
    quarters != null &&
    halfYears != null &&
    annualIndicators != null &&
    avgValid &&
    nonWorkingPeriodWarning === false

  if (!valid) {
    warnInvalid('print projection', p)
    return null
  }

  return {
    revisionId,
    headVersion,
    calendarYear,
    coverage,
    sourceSha256,
    months,
    quarters,
    halfYears,
    annual: annualIndicators,
    averageMonthly: {
      hours40: avg.hours40 as number,
      hours36: avg.hours36 as number,
      hours24: avg.hours24 as number,
    },
    nonWorkingPeriodWarning: false,
  }
}

/** Ключ «этот preview уже закрывали» — result не должен переоткрываться. */
export function printProjectionDismissKey(
  p: ProductionCalendarPrintProjection
): string {
  return `${String(p.revisionId)}:${String(p.headVersion)}:${p.sourceSha256}`
}

export function readBaseSelectionView(
  props: ProductionCalendarNodeProps
): ProductionCalendarBaseSelectionView | null {
  const outcome = props.commandOutcome
  if (
    outcome !== 'BASE_SELECTED' &&
    outcome !== 'BASE_ENABLED' &&
    outcome !== 'BASE_CLEARED'
  ) {
    return null
  }
  const result = props.commandResult
  if (!isRecord(result)) return null
  const has = result.hasBaseCalendar
  const entryId = result.baseCalendarEntryId
  if (typeof has !== 'boolean') return null
  if (entryId != null && !isFiniteNumber(entryId)) return null
  return { hasBaseCalendar: has, baseCalendarEntryId: entryId ?? null }
}
