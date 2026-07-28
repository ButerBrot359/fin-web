import { describe, expect, it } from 'vitest'

import { buildMonthWeeks } from './build-month-weeks'

describe('buildMonthWeeks: раскладка месяца, понедельник — первый', () => {
  it('январь 2025 (01.01 — среда): 2 пустых в начале, 31 день, 5 недель', () => {
    const weeks = buildMonthWeeks(2025, 0)
    expect(weeks[0]).toEqual([null, null, 1, 2, 3, 4, 5])
    expect(weeks).toHaveLength(5)
    const days = weeks.flat().filter((c) => c !== null)
    expect(days).toHaveLength(31)
    expect(days[days.length - 1]).toBe(31)
  })

  it('февраль 2024 (високосный): 29 дней, нет 30-го', () => {
    const weeks = buildMonthWeeks(2024, 1)
    const days = weeks.flat().filter((c) => c !== null)
    expect(days).toHaveLength(29)
    expect(days).toContain(29)
    expect(days).not.toContain(30)
  })

  it('каждая неделя ровно 7 ячеек', () => {
    const weeks = buildMonthWeeks(2025, 5)
    for (const w of weeks) expect(w).toHaveLength(7)
  })
})
