import { describe, expect, it } from 'vitest'

import type { ProductionCalendarNodeProps } from './production-calendar-types'
import {
  printProjectionDismissKey,
  readBaseSelectionView,
  readPrintProjection,
} from './production-calendar-command-results'

const indicators = (over: Record<string, number> = {}) => ({
  calendarDays: 31,
  workingDays: 20,
  daysOff: 11,
  hours40: 160,
  hours36: 144,
  hours24: 96,
  ...over,
})

const period = (number: number) => ({ number, indicators: indicators() })

const validProjection = () => ({
  revisionId: 7,
  headVersion: 3,
  calendarYear: 2030,
  coverage: 'FULL',
  sourceSha256: 'a'.repeat(64),
  months: Array.from({ length: 12 }, (_, i) => period(i + 1)),
  quarters: [period(1), period(2), period(3), period(4)],
  halfYears: [period(1), period(2)],
  annual: indicators(),
  averageMonthly: { hours40: 164.9, hours36: 148.4, hours24: 98.9 },
  nonWorkingPeriodWarning: false,
})

const props = (
  commandResult: unknown,
  outcome: ProductionCalendarNodeProps['commandOutcome'] = 'PRINT_READY'
): ProductionCalendarNodeProps => ({
  commandOutcome: outcome,
  commandResult,
})

describe('readPrintProjection', () => {
  it('валидный READY-результат возвращается целиком', () => {
    const p = readPrintProjection(
      props({ status: 'READY', projection: validProjection() })
    )
    expect(p).not.toBeNull()
    expect(p?.calendarYear).toBe(2030)
    expect(p?.months).toHaveLength(12)
  })

  it('исход не PRINT_READY → null', () => {
    expect(
      readPrintProjection(
        props({ status: 'READY', projection: validProjection() }, 'DAYS_STAGED')
      )
    ).toBeNull()
  })

  it('status SAVE_REQUIRED → null даже с проекцией', () => {
    expect(
      readPrintProjection(
        props({ status: 'SAVE_REQUIRED', projection: validProjection() })
      )
    ).toBeNull()
  })

  it('нарушение calendarDays = workingDays + daysOff → null', () => {
    const projection = validProjection()
    projection.annual = indicators({ calendarDays: 30 })
    expect(
      readPrintProjection(props({ status: 'READY', projection }))
    ).toBeNull()
  })

  it('отрицательные часы → null', () => {
    const projection = validProjection()
    projection.months[0] = {
      number: 1,
      indicators: indicators({ hours40: -1 }),
    }
    expect(
      readPrintProjection(props({ status: 'READY', projection }))
    ).toBeNull()
  })

  it('номер месяца вне 1..12 → null', () => {
    const projection = validProjection()
    projection.months[0] = period(13)
    expect(
      readPrintProjection(props({ status: 'READY', projection }))
    ).toBeNull()
  })

  it('год вне 1900..2200 → null', () => {
    const projection = { ...validProjection(), calendarYear: 1800 }
    expect(
      readPrintProjection(props({ status: 'READY', projection }))
    ).toBeNull()
  })

  it('nonWorkingPeriodWarning !== false → null (pinned runtime §7.1)', () => {
    const projection = { ...validProjection(), nonWorkingPeriodWarning: true }
    expect(
      readPrintProjection(props({ status: 'READY', projection }))
    ).toBeNull()
  })

  it('dismiss key = revisionId:headVersion:sourceSha256', () => {
    const p = readPrintProjection(
      props({ status: 'READY', projection: validProjection() })
    )
    expect(p && printProjectionDismissKey(p)).toBe(`7:3:${'a'.repeat(64)}`)
  })
})

describe('readBaseSelectionView', () => {
  it('BASE_SELECTED с валидным result', () => {
    expect(
      readBaseSelectionView(
        props(
          { hasBaseCalendar: true, baseCalendarEntryId: 101 },
          'BASE_SELECTED'
        )
      )
    ).toEqual({ hasBaseCalendar: true, baseCalendarEntryId: 101 })
  })

  it('не base-исход → null', () => {
    expect(
      readBaseSelectionView(
        props(
          { hasBaseCalendar: true, baseCalendarEntryId: 101 },
          'DAYS_STAGED'
        )
      )
    ).toBeNull()
  })

  it('битый result → null', () => {
    expect(
      readBaseSelectionView(props({ hasBaseCalendar: 'yes' }, 'BASE_ENABLED'))
    ).toBeNull()
  })
})
