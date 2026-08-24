import { describe, expect, it } from 'vitest'

import { fieldBoxStyle, parseMaxWidth } from './field-box-style'

describe('parseMaxWidth', () => {
  it('число из дерева проходит как есть', () => {
    expect(parseMaxWidth(304)).toBe(304)
  })

  it('строковая форма приводится к числу', () => {
    expect(parseMaxWidth('174')).toBe(174)
  })

  it('нет пропа → undefined, поле тянется по колонке', () => {
    expect(parseMaxWidth(undefined)).toBeUndefined()
    expect(parseMaxWidth(null)).toBeUndefined()
  })

  it('мусор и неположительные значения игнорируются', () => {
    expect(parseMaxWidth('широкое')).toBeUndefined()
    expect(parseMaxWidth(0)).toBeUndefined()
    expect(parseMaxWidth(-10)).toBeUndefined()
    expect(parseMaxWidth(true)).toBeUndefined()
  })
})

describe('fieldBoxStyle', () => {
  it('отдаёт flex и maxWidth вместе', () => {
    expect(fieldBoxStyle({ flex: 1, maxWidth: 304 })).toEqual({
      flex: 1,
      maxWidth: 304,
    })
  })

  it('пустые значения остаются undefined — стиль их игнорирует', () => {
    expect(fieldBoxStyle({})).toEqual({ flex: undefined, maxWidth: undefined })
  })
})
