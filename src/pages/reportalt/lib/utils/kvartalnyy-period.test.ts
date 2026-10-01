import { describe, expect, it } from 'vitest'

import { kvartalDaty } from './kvartalnyy-period'
import { defaultParamValue, kvartalnyyPeriod, type PeriodValue } from './params'
import type { ReportAltParameterDto } from '../../types/reportalt'

const period = (periodicity?: string): ReportAltParameterDto => ({
  code: 'Period',
  titleRu: 'Период',
  dataType: 'PERIOD',
  required: true,
  ...(periodicity ? { periodicity } : {}),
})

describe('Квартальный период декларации', () => {
  it('любая дата дотягивается до границ своего квартала', () => {
    expect(kvartalDaty('2026-09-01')).toEqual({
      from: '2026-07-01',
      to: '2026-09-30',
    })
    expect(kvartalDaty('2026-02-15')).toEqual({
      from: '2026-01-01',
      to: '2026-03-31',
    })
    expect(kvartalDaty('')).toBeUndefined()
  })

  it('по умолчанию квартальный период — текущий квартал, обычный — месяц', () => {
    expect(kvartalnyyPeriod(period('QUARTER'))).toBe(true)
    expect(kvartalnyyPeriod(period())).toBe(false)

    const kvartal = defaultParamValue(period('QUARTER')) as PeriodValue
    expect(kvartalDaty(kvartal.from)).toEqual(kvartal)

    const mesyats = defaultParamValue(period()) as PeriodValue
    expect(mesyats.from.slice(0, 7)).toBe(mesyats.to.slice(0, 7))
  })
})
