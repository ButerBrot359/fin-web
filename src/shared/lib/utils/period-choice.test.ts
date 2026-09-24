import { describe, expect, it } from 'vitest'

import {
  initialStartYear,
  isMonthInPeriod,
  monthPeriod,
  normalizePeriod,
  quarterPeriod,
  standardPeriod,
  unionPeriod,
  yearPeriod,
} from './period-choice'

const today = new Date(2026, 8, 24)

describe('period-choice', () => {
  it('месяц, квартал и год считаются по календарным границам', () => {
    expect(monthPeriod(2026, 6)).toEqual({
      from: '2026-07-01',
      to: '2026-07-31',
    })
    expect(monthPeriod(2028, 1)).toEqual({
      from: '2028-02-01',
      to: '2028-02-29',
    })
    expect(quarterPeriod(2026, 3)).toEqual({
      from: '2026-10-01',
      to: '2026-12-31',
    })
    expect(yearPeriod(2025)).toEqual({ from: '2025-01-01', to: '2025-12-31' })
  })

  it.each([
    ['today', '2026-09-24', '2026-09-24'],
    ['thisWeek', '2026-09-21', '2026-09-27'],
    ['lastWeek', '2026-09-14', '2026-09-20'],
    ['thisMonth', '2026-09-01', '2026-09-30'],
    ['lastMonth', '2026-08-01', '2026-08-31'],
    ['thisQuarter', '2026-07-01', '2026-09-30'],
    ['lastQuarter', '2026-04-01', '2026-06-30'],
    ['thisHalfYear', '2026-07-01', '2026-12-31'],
    ['lastHalfYear', '2026-01-01', '2026-06-30'],
    ['thisYear', '2026-01-01', '2026-12-31'],
    ['lastYear', '2025-01-01', '2025-12-31'],
    ['sinceYearStart', '2026-01-01', '2026-09-24'],
  ] as const)('стандартный период %s', (code, from, to) => {
    expect(standardPeriod(code, today)).toEqual({ from, to })
  })

  it('прошлое полугодие в первой половине года — второе полугодие прошлого года', () => {
    expect(standardPeriod('lastHalfYear', new Date(2026, 2, 1))).toEqual({
      from: '2025-07-01',
      to: '2025-12-31',
    })
  })

  it('объединение периодов растягивает границы, пустой якорь не учитывается', () => {
    expect(unionPeriod(monthPeriod(2026, 6), monthPeriod(2026, 1))).toEqual({
      from: '2026-02-01',
      to: '2026-07-31',
    })
    expect(unionPeriod({ from: '', to: '' }, monthPeriod(2026, 1))).toEqual(
      monthPeriod(2026, 1)
    )
  })

  it('месяц подсвечивается, только если целиком внутри периода', () => {
    const period = { from: '2026-07-01', to: '2026-09-30' }
    expect(isMonthInPeriod(period, 2026, 7)).toBe(true)
    expect(isMonthInPeriod(period, 2026, 5)).toBe(false)
    expect(
      isMonthInPeriod({ from: '2026-07-15', to: '2026-07-31' }, 2026, 6)
    ).toBe(false)
  })

  it('даты с временем приводятся к дню, мусор — к пустой строке', () => {
    expect(
      normalizePeriod({ from: '2026-01-01T00:00:00', to: 'не дата' })
    ).toEqual({ from: '2026-01-01', to: '' })
  })

  it('сетка открывается так, чтобы год периода стоял в середине', () => {
    expect(initialStartYear({ from: '2026-07-01', to: '2026-07-31' })).toBe(
      2025
    )
    expect(initialStartYear({ from: '', to: '' }, today)).toBe(2025)
  })
})
