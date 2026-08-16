import { describe, it, expect } from 'vitest'

import { resolveDateFormatSpec, snapToGranularity } from './date-format-spec'
import { serializeDateInput } from './serialize-date-input'

describe('resolveDateFormatSpec', () => {
  it('«dd.MM.yyyy» → день доступен, календарь как прежде', () => {
    expect(resolveDateFormatSpec('dd.MM.yyyy')).toEqual({
      granularity: 'day',
      views: ['year', 'month', 'day'],
    })
  })

  it('«MM.yyyy» → дня нет ни в видах календаря, ни в точности', () => {
    expect(resolveDateFormatSpec('MM.yyyy')).toEqual({
      granularity: 'month',
      views: ['year', 'month'],
    })
  })

  it('«LLLL yyyy» (месяц словом) — тоже месяц', () => {
    expect(resolveDateFormatSpec('LLLL yyyy').granularity).toBe('month')
  })

  it('«yyyy» → только год', () => {
    expect(resolveDateFormatSpec('yyyy')).toEqual({
      granularity: 'year',
      views: ['year'],
    })
  })

  // Литерал в кавычках — текст, а не токен: без его вырезания «д» из «'дата'»
  // включила бы выбор дня в поле, где дня нет.
  it('буквы внутри кавычек не считаются токенами', () => {
    expect(resolveDateFormatSpec("MM.yyyy 'дата'").granularity).toBe('month')
  })
})

describe('snapToGranularity', () => {
  const picked = new Date(2026, 7, 12, 15, 30) // 12.08.2026 15:30

  it('месяц → первое число', () => {
    expect(snapToGranularity(picked, 'month')).toEqual(new Date(2026, 7, 1))
  })

  it('год → 1 января', () => {
    expect(snapToGranularity(picked, 'year')).toEqual(new Date(2026, 0, 1))
  })

  it('день → значение не трогаем', () => {
    expect(snapToGranularity(picked, 'day')).toBe(picked)
  })

  it('null остаётся null (очистка поля)', () => {
    expect(snapToGranularity(null, 'month')).toBeNull()
  })

  // Контракт с сервером: формат значения не меняется — уходит полная дата.
  // «Выбран август 2026 → 2026-08-01», а не 2026-08-12.
  it('вместе с сериализацией даёт первое число месяца', () => {
    expect(serializeDateInput(snapToGranularity(picked, 'month'), true)).toBe(
      '2026-08-01'
    )
  })
})
