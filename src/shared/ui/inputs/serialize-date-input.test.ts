import { describe, it, expect } from 'vitest'

import { serializeDateInput } from './serialize-date-input'

describe('serializeDateInput', () => {
  it('dateOnly: локальная полночь сериализуется в тот же календарный день (без сдвига UTC)', () => {
    // Локальная полночь 1 июля 2026 в зоне окружения теста.
    const localMidnight = new Date(2026, 6, 1, 0, 0, 0, 0)
    expect(serializeDateInput(localMidnight, true)).toBe('2026-07-01')
  })

  // Репро аналитика: ввели «30.08.2026 00:00:00» — после записи в документе
  // стояло «29.08.2026 19:00». toISOString() переводил локальное время в UTC
  // (Астана +05), а сервер offset отрезает, не конвертируя.
  it('datetime: сериализуется как ЛОКАЛЬНОЕ время без зоны', () => {
    const d = new Date(2026, 7, 30, 0, 0, 0, 0)
    expect(serializeDateInput(d, false)).toBe('2026-08-30T00:00:00')
  })

  it('datetime: время суток сохраняется как набрано', () => {
    expect(serializeDateInput(new Date(2026, 6, 1, 12, 30, 45, 0), false)).toBe(
      '2026-07-01T12:30:45'
    )
  })

  it('datetime: миллисекунды на провод не уходят', () => {
    expect(
      serializeDateInput(new Date(2026, 6, 1, 12, 30, 0, 777), false)
    ).toBe('2026-07-01T12:30:00')
  })

  it('null и невалидная дата → пустая строка', () => {
    expect(serializeDateInput(null, true)).toBe('')
    expect(serializeDateInput(new Date('nope'), true)).toBe('')
  })

  // ── Двузначный год: SCRUM-279 D6 ──
  // Пикер MUI отдаёт год ровно так, как его набрали: две цифры «26» — это год
  // 0026, а не 2026. 1С в этой ситуации достраивает век сама, значит достраиваем
  // и мы. Дата в первом тесте — ровно из репро аналитика («01.01.26»).
  describe('двузначный год достраивается до века (D6)', () => {
    /** Год нельзя задать через `new Date(26, …)` — конструктор сам сделает 1926. */
    const dateWithYear = (year: number, month: number, day: number): Date => {
      const d = new Date(2000, month, day, 0, 0, 0, 0)
      d.setFullYear(year)
      return d
    }

    it('«01.01.26» → 2026-01-01, а не 0026-01-01', () => {
      expect(serializeDateInput(dateWithYear(26, 0, 1), true)).toBe(
        '2026-01-01'
      )
    })

    it('однозначный год «2» (потерянная цифра из репро) → 2002', () => {
      expect(serializeDateInput(dateWithYear(2, 0, 1), true)).toBe('2002-01-01')
    })

    it('год 99 → 2099 (правило не скользящее: 19xx не подставляем)', () => {
      expect(serializeDateInput(dateWithYear(99, 11, 31), true)).toBe(
        '2099-12-31'
      )
    })

    it('год 0 → 2000 (нижняя граница диапазона достройки)', () => {
      expect(serializeDateInput(dateWithYear(0, 0, 1), true)).toBe('2000-01-01')
    })

    it('год 100 не трогаем — век уже введён (верхняя граница)', () => {
      expect(serializeDateInput(dateWithYear(100, 0, 1), true)).toBe(
        '0100-01-01'
      )
    })

    it('полный год не меняется — регресс на обычном вводе', () => {
      expect(serializeDateInput(new Date(1965, 4, 20), true)).toBe('1965-05-20')
      expect(serializeDateInput(new Date(2026, 6, 30), true)).toBe('2026-07-30')
    })

    it('datetime-поля достраиваются той же воронкой', () => {
      expect(serializeDateInput(dateWithYear(26, 0, 1), false)).toBe(
        '2026-01-01T00:00:00'
      )
    })
  })
})
