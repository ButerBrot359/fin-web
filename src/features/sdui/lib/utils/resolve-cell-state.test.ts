import { describe, it, expect } from 'vitest'
import { resolveCellState } from './resolve-cell-state'
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

describe('resolveCellState — обязательность', () => {
  it('колоночный required → обязательна независимо от строки', () => {
    expect(resolveCellState(col({ required: true }), { rowId: '1' })).toEqual({
      readonly: false,
      required: true,
    })
  })

  it('binding в __requiredCells → обязательна только в этой строке', () => {
    const row: TableRow = { rowId: '1', __requiredCells: ['KodPlatnykhUslug'] }
    expect(resolveCellState(col(), row).required).toBe(true)
    // Соседняя строка (бюджетный источник) ключа не несёт.
    expect(resolveCellState(col(), { rowId: '2' }).required).toBe(false)
  })

  it('заполненная ячейка остаётся помеченной — ключ по источнику, не по пустоте', () => {
    const row: TableRow = {
      rowId: '1',
      KodPlatnykhUslug: { id: 7, presentation: 'Услуга' },
      __requiredCells: ['KodPlatnykhUslug'],
    }
    expect(resolveCellState(col(), row).required).toBe(true)
  })

  it('чужой код колонки в ключе → эта ячейка не обязательна', () => {
    const row: TableRow = { rowId: '1', __requiredCells: ['DrugayaKolonka'] }
    expect(resolveCellState(col(), row).required).toBe(false)
  })
})

describe('resolveCellState — доступность', () => {
  it('колоночный readonly → недоступна независимо от строки', () => {
    expect(resolveCellState(col({ readonly: true }), { rowId: '1' })).toEqual({
      readonly: true,
      required: false,
    })
  })

  it('binding в __readonlyCells → недоступна только в этой строке', () => {
    const row: TableRow = { rowId: '1', __readonlyCells: ['KodPlatnykhUslug'] }
    expect(resolveCellState(col(), row).readonly).toBe(true)
    expect(resolveCellState(col(), { rowId: '2' }).readonly).toBe(false)
  })

  it('__rowReadonly блокирует любую ячейку строки', () => {
    const row: TableRow = { rowId: '1', __rowReadonly: true }
    expect(resolveCellState(col(), row).readonly).toBe(true)
    expect(resolveCellState(col({ binding: 'Razmer' }), row).readonly).toBe(true)
  })
})

describe('resolveCellState — приоритет и отсутствие ключей', () => {
  // §3.3 спеки: взаимоисключающих комбинаций бэк не присылает, но правило
  // должно давать тот же результат и на них.
  it('readonly сильнее required — и по ячейке, и по строке целиком', () => {
    const byCell: TableRow = {
      rowId: '1',
      __requiredCells: ['KodPlatnykhUslug'],
      __readonlyCells: ['KodPlatnykhUslug'],
    }
    expect(resolveCellState(col(), byCell)).toEqual({
      readonly: true,
      required: false,
    })

    const byRow: TableRow = { rowId: '2', __rowReadonly: true }
    expect(resolveCellState(col({ required: true }), byRow)).toEqual({
      readonly: true,
      required: false,
    })
  })

  it('нет ключей / пустые / не тот тип → поведение прежнее, колоночное', () => {
    expect(resolveCellState(col(), { rowId: '1' })).toEqual({
      readonly: false,
      required: false,
    })
    expect(
      resolveCellState(col(), {
        rowId: '1',
        __requiredCells: [],
        __readonlyCells: [],
        __rowReadonly: false,
      })
    ).toEqual({ readonly: false, required: false })
    // Мусор вместо массива/булева не должен блокировать ввод.
    expect(
      resolveCellState(col(), {
        rowId: '1',
        __readonlyCells: 'KodPlatnykhUslug',
        __rowReadonly: 'true',
      })
    ).toEqual({ readonly: false, required: false })
  })
})
