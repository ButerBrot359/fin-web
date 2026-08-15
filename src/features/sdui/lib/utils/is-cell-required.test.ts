import { describe, it, expect } from 'vitest'
import { isCellRequired } from './is-cell-required'
import type { TableColumnDef, TableRow } from '../hooks/use-table-sync'

const col = (overrides: Partial<TableColumnDef> = {}): TableColumnDef => ({
  id: 'table.nachisleniya.col.kodPlatnykhUslug',
  label: 'Код платных услуг',
  binding: 'KodPlatnykhUslug',
  cellWidget: 'REFERENCE_FIELD',
  dataType: 'DICTIONARY',
  props: {},
  ...overrides,
})

describe('isCellRequired', () => {
  it('колоночный required → обязательна независимо от строки', () => {
    expect(isCellRequired(col({ required: true }), { rowId: '1' })).toBe(true)
  })

  it('binding в __requiredCells → обязательна только в этой строке', () => {
    const row: TableRow = { rowId: '1', __requiredCells: ['KodPlatnykhUslug'] }
    expect(isCellRequired(col(), row)).toBe(true)
    // Соседняя строка (бюджетный источник) ключа не несёт — не обязательна.
    expect(isCellRequired(col(), { rowId: '2' })).toBe(false)
  })

  it('заполненная ячейка остаётся помеченной — ключ по источнику, не по пустоте', () => {
    const row: TableRow = {
      rowId: '1',
      KodPlatnykhUslug: { id: 7, presentation: 'Услуга' },
      __requiredCells: ['KodPlatnykhUslug'],
    }
    expect(isCellRequired(col(), row)).toBe(true)
  })

  it('другой код колонки в ключе → эта ячейка не обязательна', () => {
    const row: TableRow = { rowId: '1', __requiredCells: ['DrugayaKolonka'] }
    expect(isCellRequired(col(), row)).toBe(false)
  })

  it('нет ключа / не массив → поведение прежнее', () => {
    expect(isCellRequired(col(), { rowId: '1' })).toBe(false)
    expect(isCellRequired(col(), { rowId: '1', __requiredCells: [] })).toBe(
      false
    )
    expect(
      isCellRequired(col(), { rowId: '1', __requiredCells: 'KodPlatnykhUslug' })
    ).toBe(false)
  })
})
