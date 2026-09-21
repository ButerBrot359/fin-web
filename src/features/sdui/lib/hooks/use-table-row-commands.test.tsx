import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { TableColumnDef, TableRow } from './use-table-sync'
import {
  useTableRowCommands,
  type UseTableRowCommandsParams,
} from './use-table-row-commands'

const columns: TableColumnDef[] = [
  {
    id: 'col.summa',
    label: 'Сумма',
    binding: 'summa',
    cellWidget: 'NUMBER_FIELD',
    dataType: 'NUMBER',
    props: {},
  },
]

const rows = (...ids: string[]): TableRow[] =>
  ids.map((rowId) => ({ rowId, summa: rowId.length }))

const makeSync = (fullRows: TableRow[]) => ({
  rows: fullRows,
  addRow: vi.fn(() => ({ rowId: 'tmp-new' })),
  deleteRow: vi.fn(),
  moveRow: vi.fn(),
})

const identity = (i: number) => i

const setup = (overrides: Partial<UseTableRowCommandsParams> = {}) => {
  const full = rows('a', 'b', 'c')
  const params: UseTableRowCommandsParams = {
    sync: makeSync(full),
    columns,
    visibleRows: full,
    selectedRowId: null,
    selectedVisibleIndex: -1,
    onAdd: vi.fn(),
    clearSelection: vi.fn(),
    globalIndexOf: identity,
    search: { focusInput: vi.fn(), clear: vi.fn() },
    ...overrides,
  }
  const { result } = renderHook(() => useTableRowCommands(params))
  return { result, sync: params.sync as ReturnType<typeof makeSync>, params }
}

describe('useTableRowCommands', () => {
  it('handleAdd — сквозной проброс onAdd (у complex там master-detail пресет + автопереход)', () => {
    const { result, params } = setup()
    result.current.handleAdd()
    expect(params.onAdd).toHaveBeenCalledTimes(1)
  })

  describe('remove', () => {
    it('выделено несколько строк — удаляются все, индексами по убыванию', () => {
      const full = rows('a', 'b', 'c', 'd')
      const { result, sync, params } = setup({
        sync: makeSync(full),
        visibleRows: full,
        selectedRowId: 'b',
        selectedRowIds: ['b', 'd'],
        selectedVisibleIndex: 1,
      })

      result.current.handleRemove()

      expect(sync.deleteRow.mock.calls.map((c) => c[0] as number)).toEqual([
        3, 1,
      ])
      expect(params.clearSelection).toHaveBeenCalled()
    })

    it('выделения нет — удаляется текущая строка, как раньше', () => {
      const full = rows('a', 'b', 'c')
      const { result, sync } = setup({
        sync: makeSync(full),
        visibleRows: full,
        selectedRowId: 'b',
        selectedRowIds: [],
        selectedVisibleIndex: 1,
      })

      result.current.handleRemove()

      expect(sync.deleteRow.mock.calls.map((c) => c[0] as number)).toEqual([1])
    })

    it('удаляет по rowId из ПОЛНОГО массива (SCRUM-282 C1) и снимает выделение', () => {
      const full = rows('a', 'b', 'c')
      const { result, sync, params } = setup({
        sync: makeSync(full),
        // При отборе видима только «c»: видимый индекс 0, глобальный — 2.
        visibleRows: [full[2]],
        selectedRowId: 'c',
        selectedVisibleIndex: 0,
      })
      result.current.handleRemove()
      expect(sync.deleteRow).toHaveBeenCalledWith(2)
      expect(params.clearSelection).toHaveBeenCalledTimes(1)
    })

    it('без выбранной строки не делает ничего', () => {
      const { result, sync, params } = setup()
      result.current.handleRemove()
      expect(sync.deleteRow).not.toHaveBeenCalled()
      expect(params.clearSelection).not.toHaveBeenCalled()
    })

    it('индексная селекция: после удаления текущей становится строка, вставшая на её место', () => {
      const full = rows('a', 'b', 'c')
      const onMoved = vi.fn()
      const { result } = setup({
        sync: makeSync(full),
        visibleRows: full,
        selectedRowId: 'b',
        selectedVisibleIndex: 1,
        onMoved,
      })

      result.current.handleRemove()

      expect(onMoved).toHaveBeenCalledWith(1)
    })

    it('индексная селекция: удалили последнюю — текущей становится предыдущая', () => {
      const full = rows('a', 'b', 'c')
      const onMoved = vi.fn()
      const { result } = setup({
        sync: makeSync(full),
        visibleRows: full,
        selectedRowId: 'c',
        selectedVisibleIndex: 2,
        onMoved,
      })

      result.current.handleRemove()

      expect(onMoved).toHaveBeenCalledWith(1)
    })

    it('селекция по rowId: после удаления текущей становится соседняя строка', () => {
      const full = rows('a', 'b', 'c')
      const selectRow = vi.fn()
      const { result } = setup({
        sync: makeSync(full),
        visibleRows: full,
        selectedRowId: 'b',
        selectedVisibleIndex: 1,
        selectRow,
      })

      result.current.handleRemove()

      expect(selectRow).toHaveBeenCalledWith('c')
    })

    it('удалили единственную строку — выделение снимается', () => {
      const full = rows('a')
      const { result, params } = setup({
        sync: makeSync(full),
        visibleRows: full,
        selectedRowId: 'a',
        selectedVisibleIndex: 0,
        onMoved: vi.fn(),
      })

      result.current.handleRemove()

      expect(params.clearSelection).toHaveBeenCalledTimes(1)
    })
  })

  describe('copy', () => {
    it('копирует значения без rowId и служебных ключей (service-row-keys)', () => {
      const full: TableRow[] = [
        { rowId: 'a', summa: 10, __rowReadonly: true, __requiredCells: ['x'] },
      ]
      const { result, sync } = setup({
        sync: makeSync(full),
        visibleRows: full,
        selectedRowId: 'a',
        selectedVisibleIndex: 0,
      })
      result.current.handleCopy()
      expect(sync.addRow).toHaveBeenCalledWith(columns, { summa: 10 })
    })

    it('без выбранной строки не делает ничего', () => {
      const { result, sync } = setup()
      result.current.handleCopy()
      expect(sync.addRow).not.toHaveBeenCalled()
    })
  })

  describe('move: соседом считается соседняя ВИДИМАЯ строка', () => {
    it('вверх: индексы обоих концов переводятся в глобальные (отбор разрежает набор)', () => {
      const full = rows('a', 'b', 'c', 'd')
      const visible = [full[1], full[3]] // видимы b и d
      const onMoved = vi.fn()
      const globalIndexOf = (i: number) =>
        full.findIndex((r) => r.rowId === visible[i]?.rowId)
      const { result, sync } = setup({
        sync: makeSync(full),
        visibleRows: visible,
        selectedRowId: 'd',
        selectedVisibleIndex: 1,
        globalIndexOf,
        onMoved,
      })
      result.current.handleMoveUp()
      expect(sync.moveRow).toHaveBeenCalledWith(3, 1)
      expect(onMoved).toHaveBeenCalledWith(0)
    })

    it('вниз: то же в другую сторону', () => {
      const full = rows('a', 'b', 'c')
      const onMoved = vi.fn()
      const { result, sync } = setup({
        sync: makeSync(full),
        visibleRows: full,
        selectedRowId: 'a',
        selectedVisibleIndex: 0,
        onMoved,
      })
      result.current.handleMoveDown()
      expect(sync.moveRow).toHaveBeenCalledWith(0, 1)
      expect(onMoved).toHaveBeenCalledWith(1)
    })

    it('первая строка вверх не двигается, последняя — вниз', () => {
      const full = rows('a', 'b')
      const first = setup({
        sync: makeSync(full),
        visibleRows: full,
        selectedRowId: 'a',
        selectedVisibleIndex: 0,
      })
      first.result.current.handleMoveUp()
      expect(first.sync.moveRow).not.toHaveBeenCalled()

      const last = setup({
        sync: makeSync(full),
        visibleRows: full,
        selectedRowId: 'b',
        selectedVisibleIndex: 1,
      })
      last.result.current.handleMoveDown()
      expect(last.sync.moveRow).not.toHaveBeenCalled()
    })

    it('без выбора move не делает ничего', () => {
      const { result, sync } = setup()
      result.current.handleMoveUp()
      result.current.handleMoveDown()
      expect(sync.moveRow).not.toHaveBeenCalled()
    })
  })

  describe('can*-флаги', () => {
    it('без выбора всё выключено', () => {
      const { result } = setup()
      expect(result.current.canMoveUp).toBe(false)
      expect(result.current.canMoveDown).toBe(false)
      expect(result.current.canRemove).toBe(false)
      expect(result.current.canCopy).toBe(false)
    })

    it('средняя строка: доступны обе перестановки, удаление и копия', () => {
      const full = rows('a', 'b', 'c')
      const { result } = setup({
        visibleRows: full,
        selectedRowId: 'b',
        selectedVisibleIndex: 1,
      })
      expect(result.current.canMoveUp).toBe(true)
      expect(result.current.canMoveDown).toBe(true)
      expect(result.current.canRemove).toBe(true)
      expect(result.current.canCopy).toBe(true)
    })

    it('границы: первой нельзя вверх, последней — вниз', () => {
      const full = rows('a', 'b', 'c')
      const top = setup({
        visibleRows: full,
        selectedRowId: 'a',
        selectedVisibleIndex: 0,
      })
      expect(top.result.current.canMoveUp).toBe(false)
      expect(top.result.current.canMoveDown).toBe(true)

      const bottom = setup({
        visibleRows: full,
        selectedRowId: 'c',
        selectedVisibleIndex: 2,
      })
      expect(bottom.result.current.canMoveUp).toBe(true)
      expect(bottom.result.current.canMoveDown).toBe(false)
    })
  })
})
