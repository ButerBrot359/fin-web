import { describe, expect, it } from 'vitest'

import { normalizeBodyDates } from './normalize-body-dates'

describe('normalizeBodyDates', () => {
  const meta = [
    { code: 'Data', dataType: 'DATE' },
    { code: 'Period', dataType: 'PERIOD' },
    { code: 'Imya', dataType: 'STRING' },
  ]

  it('приводит DATE и границы PERIOD к локальной дате yyyy-MM-dd', () => {
    const out = normalizeBodyDates(
      {
        Data: '2026-09-28T00:00:00',
        Period: { from: '2026-01-01T00:00:00', to: '2026-09-30' },
        Imya: '2026-01-01T00:00:00',
      },
      meta
    )
    expect(out).toEqual({
      Data: '2026-09-28',
      Period: { from: '2026-01-01', to: '2026-09-30' },
      Imya: '2026-01-01T00:00:00',
    })
  })

  it('неразбираемое значение и пустые границы оставляет как есть', () => {
    const out = normalizeBodyDates(
      { Data: 'abc', Period: { from: '', to: '' } },
      meta
    )
    expect(out).toEqual({ Data: 'abc', Period: { from: '', to: '' } })
  })
})
