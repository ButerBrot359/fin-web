import { describe, expect, it } from 'vitest'

import { validateIntervals } from './kalendari-schedule-validation'

describe('validateIntervals', () => {
  it('валидный одиночный интервал → null', () => {
    expect(validateIntervals([{ start: '09:00', end: '18:00' }])).toBeNull()
  })

  it('пустой список → null (день без интервалов допустим)', () => {
    expect(validateIntervals([])).toBeNull()
  })

  it('пустое или битое время → errInvalidTime', () => {
    expect(validateIntervals([{ start: '', end: '18:00' }])).toBe(
      'sdui.kalendari.errInvalidTime'
    )
    expect(validateIntervals([{ start: '9:00', end: '18:00' }])).toBe(
      'sdui.kalendari.errInvalidTime'
    )
    expect(validateIntervals([{ start: '25:00', end: '26:00' }])).toBe(
      'sdui.kalendari.errInvalidTime'
    )
    expect(validateIntervals([{ start: '09:70', end: '10:00' }])).toBe(
      'sdui.kalendari.errInvalidTime'
    )
  })

  it('конец ≤ начала → errEndBeforeStart', () => {
    expect(validateIntervals([{ start: '18:00', end: '09:00' }])).toBe(
      'sdui.kalendari.errEndBeforeStart'
    )
    expect(validateIntervals([{ start: '09:00', end: '09:00' }])).toBe(
      'sdui.kalendari.errEndBeforeStart'
    )
  })

  it('пересечение интервалов → errOverlap', () => {
    expect(
      validateIntervals([
        { start: '09:00', end: '13:00' },
        { start: '12:00', end: '18:00' },
      ])
    ).toBe('sdui.kalendari.errOverlap')
  })

  it('пересечение ловится и в несортированном порядке', () => {
    expect(
      validateIntervals([
        { start: '12:00', end: '18:00' },
        { start: '09:00', end: '13:00' },
      ])
    ).toBe('sdui.kalendari.errOverlap')
  })

  it('смежные интервалы (стык 12:00/12:00) валидны', () => {
    expect(
      validateIntervals([
        { start: '09:00', end: '12:00' },
        { start: '12:00', end: '18:00' },
      ])
    ).toBeNull()
  })
})
