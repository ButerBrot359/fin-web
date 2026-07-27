import { describe, it, expect } from 'vitest'

import { serializeDateInput } from './serialize-date-input'

describe('serializeDateInput', () => {
  it('dateOnly: локальная полночь сериализуется в тот же календарный день (без сдвига UTC)', () => {
    // Локальная полночь 1 июля 2026 в зоне окружения теста.
    const localMidnight = new Date(2026, 6, 1, 0, 0, 0, 0)
    expect(serializeDateInput(localMidnight, true)).toBe('2026-07-01')
  })

  it('datetime: сериализуется как ISO Z-строка (политика UTC-на-проводе не тронута)', () => {
    const d = new Date(2026, 6, 1, 12, 30, 0, 0)
    expect(serializeDateInput(d, false)).toBe(d.toISOString())
  })

  it('null и невалидная дата → пустая строка', () => {
    expect(serializeDateInput(null, true)).toBe('')
    expect(serializeDateInput(new Date('nope'), true)).toBe('')
  })
})
