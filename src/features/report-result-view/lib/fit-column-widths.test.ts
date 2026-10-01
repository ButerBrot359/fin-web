import { describe, expect, it } from 'vitest'

import { fitColumnWidths } from './fit-column-widths'

describe('fitColumnWidths', () => {
  it('не трогает ширины, если таблица помещается', () => {
    expect(
      fitColumnWidths([40, 200, 110], [true, true, false], 400, 40)
    ).toEqual([40, 200, 110])
  })

  it('ужимает только колонки без заданной ширины', () => {
    expect(
      fitColumnWidths([40, 200, 200, 200], [true, true, false, false], 440, 40)
    ).toEqual([40, 200, 100, 100])
  })

  it('не ужимает гибкие колонки меньше минимума', () => {
    expect(
      fitColumnWidths([40, 200, 110, 110], [true, true, false, false], 250, 40)
    ).toEqual([40, 200, 40, 40])
  })

  it('без заданных ширин ужимает всё пропорционально', () => {
    expect(fitColumnWidths([100, 300], [false, false], 200, 40)).toEqual([
      50, 150,
    ])
  })
})
