import { describe, expect, it } from 'vitest'

import {
  formatWireTime,
  toWireTime,
  summarizeDay,
} from './kalendari-schedule-summary'

describe('formatWireTime', () => {
  it('2000-01-01T09:00:00 → 09:00', () => {
    expect(formatWireTime('2000-01-01T09:00:00')).toBe('09:00')
  })
  it('не-строка и строка без времени → null', () => {
    expect(formatWireTime(undefined)).toBeNull()
    expect(formatWireTime(42)).toBeNull()
    expect(formatWireTime('2000-01-01')).toBeNull()
  })
})

describe('toWireTime', () => {
  it('09:00 → 2000-01-01T09:00:00', () => {
    expect(toWireTime('09:00')).toBe('2000-01-01T09:00:00')
  })
})

describe('summarizeDay', () => {
  const row = (
    rowId: string,
    day: number | undefined,
    start: unknown,
    end: unknown
  ) => ({
    rowId,
    NomerDnya: day,
    VremyaNachala: start,
    VremyaOkonchaniya: end,
  })

  it('день без строк → null', () => {
    expect(summarizeDay([], 1)).toBeNull()
  })

  it('один интервал → часы и HH:mm-границы', () => {
    const rows = [row('1', 1, '2000-01-01T09:00:00', '2000-01-01T18:00:00')]
    expect(summarizeDay(rows, 1)).toEqual({
      hours: 9,
      intervals: [{ start: '09:00', end: '18:00' }],
    })
  })

  it('интервалы отсортированы по началу, часы — сумма покруглённых до 1 знака', () => {
    const rows = [
      row('2', 1, '2000-01-01T13:00:00', '2000-01-01T16:20:00'),
      row('1', 1, '2000-01-01T09:00:00', '2000-01-01T12:00:00'),
    ]
    // 3.333… → 3.3; 3 + 3.3 = 6.3
    expect(summarizeDay(rows, 1)).toEqual({
      hours: 6.3,
      intervals: [
        { start: '09:00', end: '12:00' },
        { start: '13:00', end: '16:20' },
      ],
    })
  })

  it('строки чужих дней и день 0 не попадают в саммари', () => {
    const rows = [
      row('1', 2, '2000-01-01T09:00:00', '2000-01-01T10:00:00'),
      row('2', 0, '2000-01-01T09:00:00', '2000-01-01T10:00:00'),
    ]
    expect(summarizeDay(rows, 1)).toBeNull()
  })

  it('битые интервалы (нет времени, конец ≤ начала) не считаются валидными', () => {
    const rows = [
      row('1', 1, undefined, '2000-01-01T10:00:00'),
      row('2', 1, '2000-01-01T10:00:00', '2000-01-01T10:00:00'),
      row('3', 1, '2000-01-01T12:00:00', '2000-01-01T09:00:00'),
    ]
    expect(summarizeDay(rows, 1)).toBeNull()
  })

  it('день с валидным и битым интервалом → саммари только по валидному', () => {
    const rows = [
      row('1', 1, '2000-01-01T09:00:00', '2000-01-01T18:00:00'),
      row('2', 1, undefined, undefined),
    ]
    expect(summarizeDay(rows, 1)).toEqual({
      hours: 9,
      intervals: [{ start: '09:00', end: '18:00' }],
    })
  })
})
