import { describe, expect, it } from 'vitest'

import {
  isReferenceValue,
  toSelectOption,
  referenceToSelectOption,
  fromSelectOption,
  toReferenceValue,
  toReferenceValueOrRow,
  toReferenceArray,
} from './reference-value'

describe('isReferenceValue', () => {
  it('объект с id — ссылка', () => {
    expect(isReferenceValue({ id: 5 })).toBe(true)
    expect(isReferenceValue({ id: '5', presentation: 'Пять' })).toBe(true)
  })

  it('null/скаляр/объект без id — не ссылка', () => {
    expect(isReferenceValue(null)).toBe(false)
    expect(isReferenceValue(5)).toBe(false)
    expect(isReferenceValue('x')).toBe(false)
    expect(isReferenceValue({ presentation: 'Пять' })).toBe(false)
  })
})

describe('toSelectOption (строгий, поле шапки)', () => {
  it('ReferenceValue → SelectOption, label = presentation', () => {
    expect(toSelectOption({ id: 7, presentation: 'Иванов' })).toEqual({
      id: 7,
      code: '7',
      label: 'Иванов',
    })
  })
})

describe('referenceToSelectOption (толерантный, ячейка ТЧ)', () => {
  it('полная ссылка → опция', () => {
    expect(referenceToSelectOption({ id: 7, presentation: 'Иванов' })).toEqual({
      id: 7,
      code: '7',
      label: 'Иванов',
    })
  })

  it('строковый id приводится к числу, code остаётся строкой', () => {
    expect(referenceToSelectOption({ id: '7', presentation: 'X' })).toEqual({
      id: 7,
      code: '7',
      label: 'X',
    })
  })

  it('не-ссылка → null', () => {
    expect(referenceToSelectOption(null)).toBeNull()
    expect(referenceToSelectOption(7)).toBeNull()
    expect(referenceToSelectOption('Иванов')).toBeNull()
    expect(referenceToSelectOption({ presentation: 'X' })).toBeNull()
  })

  it('нестроковая/пустая presentation переживается через renderCellValue', () => {
    expect(referenceToSelectOption({ id: 3, presentation: 42 })?.label).toBe(
      '42'
    )
    expect(referenceToSelectOption({ id: 3, presentation: null })?.label).toBe(
      ''
    )
  })
})

describe('fromSelectOption', () => {
  it('опция → полный ссылочный объект {id, presentation}, не bare id', () => {
    expect(fromSelectOption({ id: '7', code: '7', label: 'Иванов' })).toEqual({
      id: 7,
      presentation: 'Иванов',
    })
  })
})

describe('toReferenceValue (SCRUM-291 §19.3)', () => {
  it('null/undefined → null', () => {
    expect(toReferenceValue(null)).toBeNull()
    expect(toReferenceValue(undefined)).toBeNull()
  })

  it('голый скаляр — presentation-заглушка String(id)', () => {
    expect(toReferenceValue(5)).toEqual({ id: 5, presentation: '5' })
    expect(toReferenceValue('5')).toEqual({ id: 5, presentation: '5' })
  })

  it('объект {id, presentation} нормализуется', () => {
    expect(toReferenceValue({ id: '5', presentation: 'Пять' })).toEqual({
      id: 5,
      presentation: 'Пять',
    })
    // presentation-число приводится к строке
    expect(toReferenceValue({ id: 5, presentation: 42 })).toEqual({
      id: 5,
      presentation: '42',
    })
  })

  it('объект без пригодной presentation — заглушка String(id)', () => {
    expect(toReferenceValue({ id: 5 })).toEqual({ id: 5, presentation: '5' })
    expect(toReferenceValue({ id: 5, presentation: { x: 1 } })).toEqual({
      id: 5,
      presentation: '5',
    })
  })

  it('объект без id → null', () => {
    expect(toReferenceValue({ presentation: 'Пять' })).toBeNull()
  })
})

describe('toReferenceValueOrRow', () => {
  it('прямое значение имеет приоритет над разбором по binding', () => {
    expect(
      toReferenceValueOrRow({ id: 1, presentation: 'A' }, 'Sotrudnik')
    ).toEqual({ id: 1, presentation: 'A' })
  })

  it('строка ТЧ разбирается по колонке binding', () => {
    expect(
      toReferenceValueOrRow(
        { rowId: 'r1', Sotrudnik: { id: 2, presentation: 'B' } },
        'Sotrudnik'
      )
    ).toEqual({ id: 2, presentation: 'B' })
  })

  it('без binding строка ТЧ не разбирается', () => {
    expect(
      toReferenceValueOrRow({ rowId: 'r1', Sotrudnik: { id: 2 } })
    ).toBeNull()
  })
})

describe('toReferenceArray', () => {
  it('массив: непригодные элементы отбрасываются', () => {
    expect(
      toReferenceArray([{ id: 1, presentation: 'A' }, {}, 2], undefined)
    ).toEqual([
      { id: 1, presentation: 'A' },
      { id: 2, presentation: '2' },
    ])
  })

  it('одиночное значение заворачивается в массив', () => {
    expect(toReferenceArray({ id: 1, presentation: 'A' })).toEqual([
      { id: 1, presentation: 'A' },
    ])
  })

  it('пусто → пустой массив', () => {
    expect(toReferenceArray(null)).toEqual([])
    expect(toReferenceArray({})).toEqual([])
  })
})
