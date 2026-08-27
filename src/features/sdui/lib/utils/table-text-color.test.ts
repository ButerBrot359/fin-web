import { describe, expect, it } from 'vitest'

import { tableTextColor, tableTextColorSx } from './table-text-color'

describe('tableTextColor', () => {
  it('цвет из props таблицы', () => {
    expect(tableTextColor({ textColor: '#B22222' })).toBe('#B22222')
  })

  it('пропа нет — цвет темы', () => {
    expect(tableTextColor({})).toBeUndefined()
    expect(tableTextColor(undefined)).toBeUndefined()
  })

  it('мусор игнорируется', () => {
    expect(tableTextColor({ textColor: '  ' })).toBeUndefined()
    expect(tableTextColor({ textColor: 42 })).toBeUndefined()
  })
})

describe('tableTextColorSx', () => {
  it('цвет проставляется ячейкам: MUI красит MuiTableCell-root, а не <table>', () => {
    expect(tableTextColorSx({ textColor: '#B22222' })).toEqual({
      '& .MuiTableCell-root': { color: '#B22222' },
    })
  })

  it('без пропа фрагмент пустой — sx таблицы не меняется', () => {
    expect(tableTextColorSx({})).toEqual({})
  })
})
