import { describe, expect, it } from 'vitest'

import {
  matchPeriodPreset,
  periodPresetRange,
  PERIOD_PRESETS,
} from './period-presets'

/** 19.09.2026 — дата обращения со стенда: середина сентября, III квартал. */
const SEGODNYA = new Date(2026, 8, 19)

describe('periodPresetRange', () => {
  it('текущий месяц — границы сентября', () => {
    expect(periodPresetRange('currentMonth', SEGODNYA)).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    })
  })

  it('предыдущий месяц — границы августа', () => {
    expect(periodPresetRange('previousMonth', SEGODNYA)).toEqual({
      from: '2026-08-01',
      to: '2026-08-31',
    })
  })

  it('текущий квартал — июль–сентябрь', () => {
    expect(periodPresetRange('currentQuarter', SEGODNYA)).toEqual({
      from: '2026-07-01',
      to: '2026-09-30',
    })
  })

  it('предыдущий квартал — апрель–июнь', () => {
    expect(periodPresetRange('previousQuarter', SEGODNYA)).toEqual({
      from: '2026-04-01',
      to: '2026-06-30',
    })
  })

  it('год — с 1 января по 31 декабря, предыдущий — прошлый год', () => {
    expect(periodPresetRange('currentYear', SEGODNYA)).toEqual({
      from: '2026-01-01',
      to: '2026-12-31',
    })
    expect(periodPresetRange('previousYear', SEGODNYA)).toEqual({
      from: '2025-01-01',
      to: '2025-12-31',
    })
  })

  it('январь отдаёт декабрь прошлого года, а не месяц с номером −1', () => {
    expect(periodPresetRange('previousMonth', new Date(2026, 0, 15))).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    })
    expect(periodPresetRange('previousQuarter', new Date(2026, 0, 15))).toEqual(
      {
        from: '2025-10-01',
        to: '2025-12-31',
      }
    )
  })

  it('февраль високосного года заканчивается 29-м', () => {
    expect(periodPresetRange('currentMonth', new Date(2028, 1, 10))).toEqual({
      from: '2028-02-01',
      to: '2028-02-29',
    })
  })
})

describe('matchPeriodPreset', () => {
  it('пара дат пресета опознаётся, в том числе в ISO с Z', () => {
    expect(
      matchPeriodPreset({ from: '2026-09-01', to: '2026-09-30' }, SEGODNYA)
    ).toBe('currentMonth')
    expect(
      matchPeriodPreset(
        { from: '2026-08-01T00:00:00.000Z', to: '2026-08-31T00:00:00.000Z' },
        SEGODNYA
      )
    ).toBe('previousMonth')
  })

  it('произвольный или неполный период не опознаётся', () => {
    expect(
      matchPeriodPreset({ from: '2026-09-03', to: '2026-09-19' }, SEGODNYA)
    ).toBeUndefined()
    expect(
      matchPeriodPreset({ from: '2026-09-01', to: '' }, SEGODNYA)
    ).toBeUndefined()
    expect(matchPeriodPreset(undefined, SEGODNYA)).toBeUndefined()
  })

  it('каждый пресет опознаётся по собственному диапазону', () => {
    for (const code of PERIOD_PRESETS) {
      expect(
        matchPeriodPreset(periodPresetRange(code, SEGODNYA), SEGODNYA)
      ).toBe(code)
    }
  })
})
