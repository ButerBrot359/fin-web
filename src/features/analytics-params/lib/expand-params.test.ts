import { describe, expect, it } from 'vitest'

import type { AnalyticsParameter } from '@/entities/analytics'

import { expandParams } from './expand-params'

const param = (patch: Partial<AnalyticsParameter>): AnalyticsParameter => ({
  code: 'p',
  type: 'STRING',
  required: false,
  ...patch,
})

describe('expandParams', () => {
  it('DATE_RANGE разворачивается в пару _from / _to', () => {
    const parameters = [param({ code: 'period', type: 'DATE_RANGE' })]
    const values = { period: { from: '2026-01-01', to: '2026-03-31' } }

    expect(expandParams(parameters, values)).toEqual({
      period_from: '2026-01-01',
      period_to: '2026-03-31',
    })
  })

  it('незаполненный период отдаёт null по обеим границам', () => {
    const parameters = [param({ code: 'period', type: 'DATE_RANGE' })]

    expect(expandParams(parameters, {})).toEqual({
      period_from: null,
      period_to: null,
    })
  })

  it('даты сериализуются в yyyy-MM-dd', () => {
    const parameters = [param({ code: 'on', type: 'DATE' })]

    expect(expandParams(parameters, { on: new Date(2026, 2, 7) })).toEqual({
      on: '2026-03-07',
    })
    expect(expandParams(parameters, { on: '2026-03-07' })).toEqual({
      on: '2026-03-07',
    })
  })

  it('пустые необязательные параметры уходят как null', () => {
    const parameters = [
      param({ code: 'name', type: 'STRING' }),
      param({ code: 'ref', type: 'DICTIONARY_REF' }),
      param({ code: 'kind', type: 'ENUM' }),
      param({ code: 'on', type: 'DATE' }),
      param({ code: 'flag', type: 'BOOLEAN' }),
    ]

    expect(expandParams(parameters, { name: '', ref: null })).toEqual({
      name: null,
      ref: null,
      kind: null,
      on: null,
      flag: null,
    })
  })

  it('числа приводятся к числам, булево — к булеву', () => {
    const parameters = [
      param({ code: 'limit', type: 'INTEGER' }),
      param({ code: 'rate', type: 'DECIMAL' }),
      param({ code: 'flag', type: 'BOOLEAN' }),
    ]
    const values = { limit: '10', rate: '1,5', flag: true }

    expect(expandParams(parameters, values)).toEqual({
      limit: 10,
      rate: 1.5,
      flag: true,
    })
  })

  it('значения без параметра в спецификации не попадают в запрос', () => {
    const parameters = [param({ code: 'name', type: 'STRING' })]
    const values = { name: 'Касса', stray: 'мусор' }

    expect(expandParams(parameters, values)).toEqual({ name: 'Касса' })
  })
})
