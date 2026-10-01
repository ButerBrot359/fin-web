import { describe, expect, it } from 'vitest'

import type { TableCommandDescriptor } from '../../types/view'
import { readOnlyRowId } from './read-only-row-id'
import {
  buildTableCommandAction,
  defaultRowCommand,
  isRowScopedCommand,
} from './table-command-action'

const cmd = (
  over: Partial<TableCommandDescriptor>
): TableCommandDescriptor => ({
  command: 'otchetnost.konstruktor.formy.otkryt',
  label: 'Открыть',
  enabled: true,
  behavior: { flushPendingTables: true, resetsDirty: false, closeAfter: false },
  ...over,
})

describe('isRowScopedCommand', () => {
  it('декларация бэка requiresSelectedRow', () => {
    expect(isRowScopedCommand(cmd({ requiresSelectedRow: true }))).toBe(true)
    expect(isRowScopedCommand(cmd({ requiresSelectedRow: false }))).toBe(false)
    expect(isRowScopedCommand(cmd({}))).toBe(false)
  })

  it('легаси-префиксы table.deleteRow/table.copyRow без флага', () => {
    expect(isRowScopedCommand(cmd({ command: 'table.copyRow:TMZ' }))).toBe(true)
    expect(isRowScopedCommand(cmd({ command: 'table.podbor:TMZ' }))).toBe(false)
  })
})

describe('buildTableCommandAction', () => {
  it('выбранная строка → value {rowId}; без выбора value нет', () => {
    expect(buildTableCommandAction(cmd({}), '17')).toEqual({
      type: 'COMMAND',
      command: 'otchetnost.konstruktor.formy.otkryt',
      value: { rowId: '17' },
    })
    expect(buildTableCommandAction(cmd({}), null)).toEqual({
      type: 'COMMAND',
      command: 'otchetnost.konstruktor.formy.otkryt',
    })
  })

  it('«Удалить» при нескольких выделенных — список rowIds', () => {
    expect(
      buildTableCommandAction(cmd({ command: 'table.deleteRow:T' }), 'a', [
        'a',
        'b',
      ]).value
    ).toEqual({ rowIds: ['a', 'b'] })
  })
})

describe('defaultRowCommand', () => {
  const otkryt = cmd({ requiresSelectedRow: true })

  it('ровно одна строковая команда без группы — она', () => {
    expect(
      defaultRowCommand([
        otkryt,
        cmd({ command: 'x.sozdat', label: 'Создать' }),
      ])
    ).toBe(otkryt)
  })

  it('две строковые, групповая или недоступная — null', () => {
    expect(
      defaultRowCommand([
        otkryt,
        cmd({ command: 'x.udalit', requiresSelectedRow: true }),
      ])
    ).toBeNull()
    expect(defaultRowCommand([{ ...otkryt, group: 'g' }])).toBeNull()
    expect(defaultRowCommand([{ ...otkryt, enabled: false }])).toBeNull()
    expect(defaultRowCommand([])).toBeNull()
  })

  it('явная пометка defaultForRow побеждает правило «одна строковая команда»', () => {
    const izmenit = {
      ...otkryt,
      command: 'x.izmenit',
      label: 'Изменить',
      defaultForRow: true,
    }
    const udalit = { ...otkryt, command: 'x.udalit', label: 'Удалить' }
    expect(defaultRowCommand([udalit, izmenit])?.command).toBe('x.izmenit')
    expect(
      defaultRowCommand([udalit, { ...izmenit, enabled: false }])
    ).toBeNull()
  })
})

describe('readOnlyRowId', () => {
  it('rowId ТЧ приоритетнее id push-модели; число — строкой', () => {
    expect(readOnlyRowId({ rowId: 'r1', id: '9' })).toBe('r1')
    expect(readOnlyRowId({ id: '17', formaId: 17 })).toBe('17')
    expect(readOnlyRowId({ id: 42 })).toBe('42')
    expect(readOnlyRowId({ id: 'razdel:klyuch' })).toBe('razdel:klyuch')
  })

  it('без идентичности — null', () => {
    expect(readOnlyRowId({ kod: 'F1' })).toBeNull()
    expect(readOnlyRowId({ id: '' })).toBeNull()
    expect(readOnlyRowId({ id: { x: 1 } })).toBeNull()
  })
})
