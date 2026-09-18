import { describe, expect, it } from 'vitest'

import { toDisplayString, formatReadonlyValue } from './format-readonly-cell'

describe('toDisplayString', () => {
  it('null/undefined → пустая строка', () => {
    expect(toDisplayString(null)).toBe('')
    expect(toDisplayString(undefined)).toBe('')
  })

  it('примитивы — как есть', () => {
    expect(toDisplayString('текст')).toBe('текст')
    expect(toDisplayString(42)).toBe('42')
    expect(toDisplayString(true)).toBe('true')
  })

  it('ссылочный объект разворачивается в presentation', () => {
    expect(toDisplayString({ id: 1, presentation: 'Иванов' })).toBe('Иванов')
  })
})

describe('formatReadonlyValue', () => {
  it('пусто → пустая строка', () => {
    expect(formatReadonlyValue(null, 'STRING')).toBe('')
    expect(formatReadonlyValue('', 'STRING')).toBe('')
  })

  it('объект с presentation побеждает независимо от dataType', () => {
    expect(
      formatReadonlyValue({ id: 1, presentation: 'Оклад' }, 'DECIMAL')
    ).toBe('Оклад')
  })

  it('STRING/TEXT — как есть', () => {
    expect(formatReadonlyValue('привет', 'TEXT')).toBe('привет')
  })

  it('INTEGER/DECIMAL — разряды через пробел, точка → запятая', () => {
    expect(formatReadonlyValue(1234567, 'INTEGER')).toBe('1 234 567')
    expect(formatReadonlyValue(1234.5, 'DECIMAL')).toBe('1 234,5')
  })

  it('DATE — формат колонки, нестрока → пусто', () => {
    expect(formatReadonlyValue('2026-09-01', 'DATE')).toBe('01.09.2026')
    expect(formatReadonlyValue('2026-09-01', 'DATE', 'MM.yyyy')).toBe('09.2026')
    expect(formatReadonlyValue(20260901, 'DATE')).toBe('')
  })

  it('DATETIME — дата+время без формата, формат колонки при наличии', () => {
    expect(formatReadonlyValue('2026-09-01T10:30:00', 'DATETIME')).toBe(
      '01.09.2026 10:30'
    )
    expect(
      formatReadonlyValue('2026-09-01T10:30:00', 'DATETIME', 'dd.MM.yyyy')
    ).toBe('01.09.2026')
    expect(formatReadonlyValue(123, 'DATETIME')).toBe('')
  })

  it('BOOLEAN — галочка только на true/"true"', () => {
    expect(formatReadonlyValue(true, 'BOOLEAN')).toBe('✓')
    expect(formatReadonlyValue('true', 'BOOLEAN')).toBe('✓')
    expect(formatReadonlyValue(false, 'BOOLEAN')).toBe('')
    expect(formatReadonlyValue(1, 'BOOLEAN')).toBe('')
  })

  it('неизвестный dataType — renderCellValue', () => {
    expect(formatReadonlyValue('x', 'UNKNOWN')).toBe('x')
  })
})
