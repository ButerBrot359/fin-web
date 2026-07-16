import { describe, expect, it } from 'vitest'

import { filterDetailRows, findSelectedMasterRow } from './master-detail'

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
      'VychetIPN',
    )
    expect(result.map((r) => r.rowId)).toEqual(['d1', 'd3'])
  })

  it('без выбранной master-строки возвращает все строки', () => {
    expect(
      filterDetailRows(detailRows, undefined, 'VychetIPN', 'VychetIPN'),
    ).toEqual(detailRows)
  })

  it('строка с пустым ключом не матчится', () => {
    const rows = [{ rowId: 'd4', VychetIPN: '' }]
    expect(
      filterDetailRows(rows, masterRows[0], 'VychetIPN', 'VychetIPN'),
    ).toEqual([])
  })
})
