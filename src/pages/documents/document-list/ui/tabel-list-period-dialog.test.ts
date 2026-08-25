import { describe, expect, it } from 'vitest'

import { toTabelListPeriodCondition } from '../lib/tabel-list-period'

describe('toTabelListPeriodCondition', () => {
  it('turns both dates into the document list DATE range filter', () => {
    expect(
      toTabelListPeriodCondition({ from: '2026-08-01', to: '2026-08-31' })
    ).toEqual({
      field: 'Data',
      op: 'between',
      value: ['2026-08-01', '2026-08-31'],
    })
  })

  it('supports one-sided periods and clearing', () => {
    expect(toTabelListPeriodCondition({ from: '2026-08-01', to: '' })).toEqual({
      field: 'Data',
      op: 'gte',
      value: '2026-08-01',
    })
    expect(toTabelListPeriodCondition({ from: '', to: '' })).toBeNull()
  })
})
