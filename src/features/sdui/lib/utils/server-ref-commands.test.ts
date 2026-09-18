import { describe, expect, it, vi } from 'vitest'

import type { TableColumnDef, TableRow } from '../hooks/use-table-sync'
import {
  createServerRefCommands,
  type ServerRefDispatch,
} from './server-ref-commands'

const baseCol = (overrides: Partial<TableColumnDef> = {}): TableColumnDef => ({
  id: 'col.sotrudnik',
  label: 'Сотрудник',
  binding: 'sotrudnik',
  cellWidget: 'REFERENCE_FIELD',
  dataType: 'REFERENCE',
  props: {},
  ...overrides,
})

const row: TableRow = {
  rowId: 'r1',
  sotrudnik: { id: 5, presentation: 'Иванов' },
}

const makeDispatchRef = () => {
  const dispatch = vi.fn<ServerRefDispatch>(() => Promise.resolve(true))
  return { dispatch, dispatchRef: { current: dispatch } }
}

describe('createServerRefCommands', () => {
  it('trigger → COMMAND с координатой строки (ADR-0029 2b)', () => {
    const { dispatch, dispatchRef } = makeDispatchRef()
    const col = baseCol({
      actions: [
        {
          trigger: 'showAll',
          actionId: 'command',
          command: 'table.cell.showAll:Tabl.sotrudnik',
        },
      ],
    })

    const commands = createServerRefCommands(dispatchRef, col, row)
    expect(commands.onServerShowAll).toBeDefined()
    commands.onServerShowAll?.()

    expect(dispatch).toHaveBeenCalledWith({
      type: 'COMMAND',
      command: 'table.cell.showAll:Tabl.sotrudnik',
      sourceNodeId: 'col.sotrudnik',
      value: { rowId: 'r1', row },
    })
  })

  it('каждый триггер ищет СВОЮ команду', () => {
    const { dispatch, dispatchRef } = makeDispatchRef()
    const col = baseCol({
      actions: [
        { trigger: 'showAll', actionId: 'command', command: 'cmd.showAll' },
        { trigger: 'create', actionId: 'command', command: 'cmd.create' },
        { trigger: 'open', actionId: 'command', command: 'cmd.open' },
      ],
    })

    const commands = createServerRefCommands(dispatchRef, col, row)
    commands.onServerCreate?.()
    commands.onServerOpen?.()

    expect(dispatch.mock.calls.map((c) => c[0].command)).toEqual([
      'cmd.create',
      'cmd.open',
    ])
  })

  it('нет команды для триггера ⇒ undefined (откат ячейки в легаси-пикер)', () => {
    const { dispatchRef } = makeDispatchRef()
    const col = baseCol({
      actions: [
        { trigger: 'showAll', actionId: 'command', command: 'cmd.showAll' },
      ],
    })

    const commands = createServerRefCommands(dispatchRef, col, row)
    expect(commands.onServerCreate).toBeUndefined()
    expect(commands.onServerOpen).toBeUndefined()
  })

  it('action с чужим actionId командой не считается', () => {
    const { dispatchRef } = makeDispatchRef()
    const col = baseCol({
      actions: [{ trigger: 'showAll', actionId: 'fieldEvent' }],
    })

    const commands = createServerRefCommands(dispatchRef, col, row)
    expect(commands.onServerShowAll).toBeUndefined()
  })

  it('колонка без actions ⇒ все хендлеры undefined', () => {
    const { dispatchRef } = makeDispatchRef()
    const commands = createServerRefCommands(dispatchRef, baseCol(), row)
    expect(commands.onServerShowAll).toBeUndefined()
    expect(commands.onServerCreate).toBeUndefined()
    expect(commands.onServerOpen).toBeUndefined()
  })

  it('dispatch читается из ref в момент клика, а не в момент сборки', () => {
    const { dispatchRef } = makeDispatchRef()
    const col = baseCol({
      actions: [
        { trigger: 'showAll', actionId: 'command', command: 'cmd.showAll' },
      ],
    })
    const commands = createServerRefCommands(dispatchRef, col, row)

    const fresh = vi.fn<ServerRefDispatch>(() => Promise.resolve(true))
    dispatchRef.current = fresh
    commands.onServerShowAll?.()

    expect(fresh).toHaveBeenCalledTimes(1)
  })
})
