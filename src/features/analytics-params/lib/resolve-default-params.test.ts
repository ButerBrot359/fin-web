import { describe, expect, it } from 'vitest'

import type { AnalyticsParameter } from '@/entities/analytics'

import { resolveDefaultParams } from './resolve-default-params'

/** 15 июня 2026 — середина месяца и года, все границы различимы. */
const NOW = new Date(2026, 5, 15, 12, 0, 0)

const param = (patch: Partial<AnalyticsParameter>): AnalyticsParameter => ({
  code: 'p',
  type: 'DATE',
  required: false,
  ...patch,
})

describe('resolveDefaultParams', () => {
  it('раскрывает макросы дат', () => {
    const parameters = [
      param({ code: 'today', defaultValue: '@today' }),
      param({ code: 'som', defaultValue: '@startOfMonth' }),
      param({ code: 'eom', defaultValue: '@endOfMonth' }),
      param({ code: 'soy', defaultValue: '@startOfYear' }),
      param({ code: 'eoy', defaultValue: '@endOfYear' }),
      param({ code: 'sopy', defaultValue: '@startOfPrevYear' }),
      param({ code: 'eopy', defaultValue: '@endOfPrevYear' }),
    ]

    expect(resolveDefaultParams(parameters, NOW)).toEqual({
      today: '2026-06-15',
      som: '2026-06-01',
      eom: '2026-06-30',
      soy: '2026-01-01',
      eoy: '2026-12-31',
      sopy: '2025-01-01',
      eopy: '2025-12-31',
    })
  })

  it('значение-не-макрос отдаёт как есть', () => {
    const parameters = [
      param({ code: 'name', type: 'STRING', defaultValue: 'Касса' }),
      param({ code: 'limit', type: 'INTEGER', defaultValue: 10 }),
      param({ code: 'date', defaultValue: '2026-01-31' }),
    ]

    expect(resolveDefaultParams(parameters, NOW)).toEqual({
      name: 'Касса',
      limit: 10,
      date: '2026-01-31',
    })
  })

  it('DATE_RANGE раскрывается в пару дат из массива или объекта', () => {
    const parameters = [
      param({
        code: 'period',
        type: 'DATE_RANGE',
        defaultValue: ['@startOfMonth', '@endOfMonth'],
      }),
      param({
        code: 'year',
        type: 'DATE_RANGE',
        defaultValue: { from: '@startOfYear', to: '@endOfYear' },
      }),
    ]

    expect(resolveDefaultParams(parameters, NOW)).toEqual({
      period: { from: '2026-06-01', to: '2026-06-30' },
      year: { from: '2026-01-01', to: '2026-12-31' },
    })
  })

  it('без defaultValue: булево — false, остальное — null', () => {
    const parameters = [
      param({ code: 'flag', type: 'BOOLEAN' }),
      param({ code: 'name', type: 'STRING' }),
      param({ code: 'period', type: 'DATE_RANGE' }),
    ]

    expect(resolveDefaultParams(parameters, NOW)).toEqual({
      flag: false,
      name: null,
      period: { from: null, to: null },
    })
  })

  it('неизвестный макрос не ломает раскрытие', () => {
    const parameters = [param({ code: 'x', defaultValue: '@unknownMacro' })]
    expect(resolveDefaultParams(parameters, NOW)).toEqual({ x: null })
  })
})
