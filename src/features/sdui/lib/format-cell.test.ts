import { describe, expect, it } from 'vitest'

import { formatSduiCellValue } from './format-cell'

describe('formatSduiCellValue', () => {
  it('DATE → дд.мм.гггг', () => {
    expect(formatSduiCellValue('2026-06-09', 'DATE')).toBe('09.06.2026')
  })

  it('DATETIME с полуночью — время опускается (как в 1С)', () => {
    expect(formatSduiCellValue('2026-06-09T00:00:00', 'DATETIME')).toBe('09.06.2026')
  })

  it('DATETIME со временем → дд.мм.гггг чч:мм', () => {
    expect(formatSduiCellValue('2026-06-09T14:30:00', 'DATETIME')).toBe('09.06.2026 14:30')
  })

  it('BOOLEAN → галочка/пусто', () => {
    expect(formatSduiCellValue(true, 'BOOLEAN')).toBe('✓')
    expect(formatSduiCellValue(false, 'BOOLEAN')).toBe('')
    expect(formatSduiCellValue('true', 'BOOLEAN')).toBe('✓')
  })

  it('null/undefined/пустая строка → пусто для любого типа', () => {
    expect(formatSduiCellValue(null, 'DATE')).toBe('')
    expect(formatSduiCellValue(undefined, 'BOOLEAN')).toBe('')
    expect(formatSduiCellValue('', 'STRING')).toBe('')
  })

  it('STRING/INTEGER/без dataType — как есть', () => {
    expect(formatSduiCellValue('текст', 'STRING')).toBe('текст')
    expect(formatSduiCellValue(42, 'INTEGER')).toBe('42')
    expect(formatSduiCellValue('x', undefined)).toBe('x')
  })

  it('невалидная дата не падает — исходная строка', () => {
    expect(formatSduiCellValue('не-дата', 'DATE')).toBe('не-дата')
  })
})
