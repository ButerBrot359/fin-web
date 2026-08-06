import { describe, it, expect } from 'vitest'
import { isCellEmpty } from './is-cell-empty'

describe('isCellEmpty', () => {
  it('null/undefined/"" — пусто', () => {
    expect(isCellEmpty(null, 'TEXT_FIELD')).toBe(true)
    expect(isCellEmpty(undefined, 'TEXT_FIELD')).toBe(true)
    expect(isCellEmpty('', 'TEXT_FIELD')).toBe(true)
  })
  it('0 и false — НЕ пусто', () => {
    expect(isCellEmpty(0, 'NUMBER_FIELD')).toBe(false)
    expect(isCellEmpty(false, 'CHECKBOX_FIELD')).toBe(false)
  })
  it('непустая строка — НЕ пусто', () => {
    expect(isCellEmpty('x', 'TEXT_FIELD')).toBe(false)
  })
  it('REFERENCE без id — пусто, с id — НЕ пусто', () => {
    expect(isCellEmpty(null, 'REFERENCE_FIELD')).toBe(true)
    expect(isCellEmpty({ presentation: 'X' }, 'REFERENCE_FIELD')).toBe(true)
    expect(isCellEmpty({ id: 5, presentation: 'X' }, 'REFERENCE_FIELD')).toBe(
      false
    )
  })
  it('OBJECT_FIELD без id — пусто', () => {
    expect(isCellEmpty({ member: 'A' }, 'OBJECT_FIELD')).toBe(true)
    expect(isCellEmpty({ id: 1 }, 'OBJECT_FIELD')).toBe(false)
  })
})
