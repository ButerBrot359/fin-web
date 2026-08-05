import { describe, expect, it } from 'vitest'

import {
  filterDetailRows,
  findSelectedMasterRow,
  rowContentSignature,
} from './master-detail'

const masterRows = [
  { rowId: 'm1', VychetIPN: 'A' },
  { rowId: 'm2', VychetIPN: 'B' },
]
const detailRows = [
  { rowId: 'd1', VychetIPN: 'A' },
  { rowId: 'd2', VychetIPN: 'B' },
  { rowId: 'd3', VychetIPN: 'A' },
]

describe('findSelectedMasterRow', () => {
  it('находит master-строку по выбранному rowId', () => {
    expect(findSelectedMasterRow(masterRows, 'm2')).toEqual(masterRows[1])
  })

  it('возвращает undefined без выбора или без строк', () => {
    expect(findSelectedMasterRow(masterRows, undefined)).toBeUndefined()
    expect(findSelectedMasterRow(undefined, 'm1')).toBeUndefined()
    expect(findSelectedMasterRow(masterRows, 'нет-такого')).toBeUndefined()
  })
})

describe('filterDetailRows', () => {
  it('оставляет только строки с ключом выбранной master-строки', () => {
    const result = filterDetailRows(
      detailRows,
      masterRows[0],
      'VychetIPN',
      'VychetIPN'
    )
    expect(result.map((r) => r.rowId)).toEqual(['d1', 'd3'])
  })

  it('без выбранной master-строки возвращает все строки', () => {
    expect(
      filterDetailRows(detailRows, undefined, 'VychetIPN', 'VychetIPN')
    ).toEqual(detailRows)
  })

  it('строка с пустым ключом не матчится', () => {
    const rows = [{ rowId: 'd4', VychetIPN: '' }]
    expect(
      filterDetailRows(rows, masterRows[0], 'VychetIPN', 'VychetIPN')
    ).toEqual([])
  })
})

// SCRUM-291 §0.5 дефект 2: master-detail показывает чужой график после
// пересборки ТЧ (rowId — порядковый номер, не устойчивая идентичность
// записи). rowContentSignature — суррогат «это всё ещё та же запись?».
describe('rowContentSignature', () => {
  it('не зависит от rowId', () => {
    // та же запись под разными rowId — подпись совпадает
    expect(rowContentSignature({ rowId: 'a', VychetIPN: 'A' })).toBe(
      rowContentSignature({ rowId: 'b', VychetIPN: 'A' })
    )
    // разные записи под ОДНИМ rowId — подпись различается (рабочий случай дефекта)
    expect(rowContentSignature({ rowId: 'a', VychetIPN: 'A' })).not.toBe(
      rowContentSignature({ rowId: 'a', VychetIPN: 'B' })
    )
  })

  it('не зависит от порядка полей', () => {
    expect(
      rowContentSignature({ rowId: 'a', VychetIPN: 'A', Summa: 100 })
    ).toBe(rowContentSignature({ rowId: 'a', Summa: 100, VychetIPN: 'A' }))
  })

  it('ссылочная ячейка сводится к id', () => {
    // тот же id, другая презентация (язык формы) — подпись совпадает
    expect(
      rowContentSignature({
        rowId: 'a',
        VychetIPN: { id: '5', presentation: 'ИПН 10%' },
      })
    ).toBe(
      rowContentSignature({
        rowId: 'a',
        VychetIPN: { id: '5', presentation: 'ЖТС 10%' },
      })
    )
    // другой id, та же презентация — подпись различается
    expect(
      rowContentSignature({
        rowId: 'a',
        VychetIPN: { id: '5', presentation: 'ИПН 10%' },
      })
    ).not.toBe(
      rowContentSignature({
        rowId: 'a',
        VychetIPN: { id: '6', presentation: 'ИПН 10%' },
      })
    )
  })

  it('различает отсутствующее и пустое значение колонки', () => {
    expect(rowContentSignature({ rowId: 'a' })).not.toBe(
      rowContentSignature({ rowId: 'a', VychetIPN: '' })
    )
  })
})
