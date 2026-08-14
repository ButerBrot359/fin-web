import { describe, expect, it } from 'vitest'

import { summarizeSchedule } from './kalendari-schedule-summary'

describe('summarizeSchedule', () => {
  it('суммирует часы всех интервалов', () => {
    const rows = [
      {
        rowId: '1',
        NomerDnya: 1,
        VremyaNachala: '2000-01-01T09:00:00',
        VremyaOkonchaniya: '2000-01-01T18:00:00',
      },
      {
        rowId: '2',
        NomerDnya: 1,
        VremyaNachala: '2000-01-01T19:00:00',
        VremyaOkonchaniya: '2000-01-01T21:00:00',
      },
    ]
    expect(summarizeSchedule(rows).totalHours).toBe(11)
  })
  it('пустой список → 0 часов, 0 дней', () => {
    expect(summarizeSchedule([])).toEqual({ totalHours: 0, dayCount: 0 })
  })
  it('считает уникальные NomerDnya', () => {
    const rows = [
      {
        rowId: '1',
        NomerDnya: 1,
        VremyaNachala: '2000-01-01T09:00:00',
        VremyaOkonchaniya: '2000-01-01T10:00:00',
      },
      {
        rowId: '2',
        NomerDnya: 2,
        VremyaNachala: '2000-01-01T09:00:00',
        VremyaOkonchaniya: '2000-01-01T10:00:00',
      },
    ]
    expect(summarizeSchedule(rows).dayCount).toBe(2)
  })
})
