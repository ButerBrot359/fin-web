import { describe, expect, it } from 'vitest'

import {
  displayPatternForFormat,
  parseDisplayDate,
  toDate,
  toIsoDate,
  toIsoDateTime,
} from './iso-date'

describe('toDate', () => {
  it('принимает Date и ISO-строку, пустое и мусор дают null', () => {
    const date = new Date(2026, 8, 28)
    expect(toDate(date)).toBe(date)
    expect(toDate('2026-09-28')).toEqual(new Date(2026, 8, 28))
    expect(toDate('')).toBeNull()
    expect(toDate('  ')).toBeNull()
    expect(toDate('abc')).toBeNull()
    expect(toDate(new Date('x'))).toBeNull()
    expect(toDate(42)).toBeNull()
    expect(toDate(null)).toBeNull()
  })
})

describe('toIsoDate', () => {
  it('отдаёт локальную календарную дату без сдвига в UTC', () => {
    expect(toIsoDate(new Date(2026, 8, 28, 0, 30))).toBe('2026-09-28')
    expect(toIsoDate('2026-09-28T23:59:59')).toBe('2026-09-28')
  })

  it('достраивает двузначный год до 20xx', () => {
    const date = new Date(2026, 0, 1)
    date.setFullYear(26)
    expect(toIsoDate(date)).toBe('2026-01-01')
  })

  it('несуществующая дата даёт null', () => {
    expect(toIsoDate('2026-02-31')).toBeNull()
    expect(toIsoDate(undefined)).toBeNull()
  })
})

describe('toIsoDateTime', () => {
  it('отдаёт локальное время без зоны и миллисекунд', () => {
    expect(toIsoDateTime(new Date(2026, 8, 28, 14, 5, 7, 123))).toBe(
      '2026-09-28T14:05:07'
    )
    expect(toIsoDateTime('2026-09-28T14:05')).toBe('2026-09-28T14:05:00')
    expect(toIsoDateTime('')).toBeNull()
  })
})

describe('parseDisplayDate', () => {
  it('разбирает дд.ММ.гггг и отвергает несуществующие даты', () => {
    expect(parseDisplayDate('28.09.2026')).toEqual(new Date(2026, 8, 28))
    expect(parseDisplayDate(' 28.09.2026 12:00')).toEqual(new Date(2026, 8, 28))
    expect(parseDisplayDate('31.02.2026')).toBeNull()
    expect(parseDisplayDate('2026-09-28')).toBeNull()
  })
})

describe('displayPatternForFormat', () => {
  it('со временем, только если формат колонки содержит часы', () => {
    expect(displayPatternForFormat('DLF=DT')).toBe('dd.MM.yyyy')
    expect(displayPatternForFormat('dd.MM.yyyy HH:mm:ss')).toBe(
      'dd.MM.yyyy HH:mm:ss'
    )
    expect(displayPatternForFormat(undefined)).toBe('dd.MM.yyyy')
  })
})
