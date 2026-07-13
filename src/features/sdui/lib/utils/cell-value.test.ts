import { describe, expect, it } from 'vitest'

import { renderCellValue, normalizeKey } from './cell-value'

describe('renderCellValue', () => {
  it('объект с presentation → presentation строкой', () => {
    expect(renderCellValue({ id: 5, presentation: 'ИПН 10%' })).toBe('ИПН 10%')
  })

  it('presentation null → пустая строка', () => {
    expect(renderCellValue({ id: 5, presentation: null })).toBe('')
  })

  it('примитивы и null → String(value ?? "")', () => {
    expect(renderCellValue('abc')).toBe('abc')
    expect(renderCellValue(42)).toBe('42')
    expect(renderCellValue(null)).toBe('')
    expect(renderCellValue(undefined)).toBe('')
  })
})

describe('normalizeKey', () => {
  it('объект с id → id', () => {
    expect(normalizeKey({ id: '7', presentation: 'x' })).toBe('7')
  })

  it('примитив → как есть', () => {
    expect(normalizeKey(7)).toBe(7)
    expect(normalizeKey(null)).toBe(null)
  })
})
