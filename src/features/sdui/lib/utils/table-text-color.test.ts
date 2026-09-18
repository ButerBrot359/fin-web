import { describe, expect, it } from 'vitest'

import { textColorProp, tableTextColorSx } from './table-text-color'

describe('textColorProp', () => {
  it('цвет из props узла (таблицы или колонки — функция одна)', () => {
    expect(textColorProp({ textColor: '#B22222' })).toBe('#B22222')
  })

  it('пропа нет — цвет темы', () => {
    expect(textColorProp({})).toBeUndefined()
    expect(textColorProp(undefined)).toBeUndefined()
  })

  it('мусор игнорируется', () => {
    expect(textColorProp({ textColor: '  ' })).toBeUndefined()
    expect(textColorProp({ textColor: 42 })).toBeUndefined()
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
