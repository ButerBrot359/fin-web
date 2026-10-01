import { describe, expect, it } from 'vitest'

import type { ItogiRow } from './itogi-columns'
import { itogiParentIds, visibleItogiRows } from './itogi-tree'

const r = (rowId: string, parent: string | null): ItogiRow => ({
  rowId,
  __level: parent ? parent.split('/').length : 0,
  __parentRowId: parent,
})

const rows = [
  r('f1', null),
  r('f1/p', 'f1'),
  r('f1/p/s', 'f1/p'),
  r('f2', null),
  r('f2/p', 'f2'),
  r('__itogo', null),
]

describe('visibleItogiRows', () => {
  it('свёрнуто — физлица и «Итого» последней, порядок сервера', () => {
    expect(visibleItogiRows(rows, new Set()).map((x) => x.rowId)).toEqual([
      'f1',
      'f2',
      '__itogo',
    ])
  })

  it('раскрытие ветки показывает её детей на месте', () => {
    expect(
      visibleItogiRows(rows, new Set(['f1', 'f1/p'])).map((x) => x.rowId)
    ).toEqual(['f1', 'f1/p', 'f1/p/s', 'f2', '__itogo'])
  })

  it('«Развернуть» по всем родителям показывает все строки', () => {
    expect(visibleItogiRows(rows, itogiParentIds(rows))).toHaveLength(
      rows.length
    )
  })
})

describe('itogiParentIds', () => {
  it('«Итого» и листья родителями не считаются', () => {
    expect([...itogiParentIds(rows)].sort()).toEqual(['f1', 'f1/p', 'f2'])
  })
})
