import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { sbrositKopiyu, stroitTsv } from '../utils/table-clipboard'

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
  replaceRows: vi.fn(),
  undo: vi.fn(() => true),
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

describe('useTableRowCommands — буфер обмена и отмена', () => {
  const writeText = vi.fn<(text: string) => Promise<void>>()

  beforeEach(() => {
    sbrositKopiyu()
    writeText.mockReset()
    writeText.mockResolvedValue(undefined)
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
  })

  const tovarKolonki: TableColumnDef[] = [
    {
      id: 'col.tovar',
      label: 'Товар',
      binding: 'tovar',
      cellWidget: 'REFERENCE_FIELD',
      dataType: 'DICTIONARY',
      props: {},
    },
    {
      id: 'col.summa',
      label: 'Сумма',
      binding: 'summa',
      cellWidget: 'NUMBER_FIELD',
      dataType: 'DECIMAL',
      props: {},
    },
    {
      id: 'col.klyuch',
      label: 'Ключ связи',
      binding: 'klyuch',
      cellWidget: 'TEXT_FIELD',
      dataType: 'STRING',
      props: { visible: false },
    },
  ]

  const tovarStroki = (): TableRow[] => [
    {
      rowId: 'r1',
      tovar: { id: 7, presentation: 'Стол' },
      summa: 100,
      klyuch: 'k-1',
    },
    {
      rowId: 'r2',
      tovar: { id: 8, presentation: 'Стул' },
      summa: 200,
      klyuch: 'k-1',
    },
  ]

  const setupTovary = (overrides: Partial<UseTableRowCommandsParams> = {}) => {
    const full = tovarStroki()
    const params: UseTableRowCommandsParams = {
      sync: makeSync(full),
      columns: tovarKolonki,
      visibleRows: full,
      selectedRowId: 'r1',
      selectedVisibleIndex: 0,
      onAdd: vi.fn(),
      clearSelection: vi.fn(),
      globalIndexOf: identity,
      search: { focusInput: vi.fn(), clear: vi.fn() },
      ...overrides,
    }
    const { result } = renderHook(() => useTableRowCommands(params))
    return { result, sync: params.sync as ReturnType<typeof makeSync>, full }
  }

  const pasteEvent = (text: string, targetTag = 'div') => {
    const target = document.createElement(targetTag)
    return {
      target,
      clipboardData: { getData: () => text },
      preventDefault: vi.fn(),
    } as unknown as React.ClipboardEvent<HTMLElement>
  }

  it('Ctrl+C: в системный буфер уходит TSV по видимым колонкам', () => {
    const { result } = setupTovary({
      selectedRowIds: ['r1', 'r2'],
    })
    result.current.handleCopyToClipboard()
    expect(writeText).toHaveBeenCalledWith('Стол\t100\nСтул\t200')
  })

  it('без выделения копировать нечего', () => {
    const { result } = setupTovary({ selectedRowId: null })
    result.current.handleCopyToClipboard()
    expect(writeText).not.toHaveBeenCalled()
  })

  it('копия-вставка внутри приложения доносит ссылку и скрытую колонку', () => {
    const { result, sync, full } = setupTovary({ selectedRowIds: ['r1'] })
    result.current.handleCopyToClipboard()
    result.current.handlePasteEvent(
      pasteEvent(stroitTsv([full[0]], tovarKolonki.slice(0, 2)))
    )
    const next = sync.replaceRows.mock.calls[0][0] as TableRow[]
    expect(next).toHaveLength(3)
    expect(next[2]).toMatchObject({
      tovar: { id: 7, presentation: 'Стол' },
      summa: 100,
      klyuch: 'k-1',
    })
    // Новая строка — своя: rowId источника не копируется
    expect(next[2].rowId).not.toBe('r1')
  })

  it('чужой текст из Excel разбирается по видимым колонкам; ссылка остаётся пустой', () => {
    const { result, sync } = setupTovary()
    result.current.handlePasteEvent(pasteEvent('Шкаф\t300\nПолка\t50'))
    const next = sync.replaceRows.mock.calls[0][0] as TableRow[]
    expect(next).toHaveLength(4)
    expect(next[2]).toMatchObject({ summa: 300, tovar: null })
    expect(next[3]).toMatchObject({ summa: 50 })
  })

  it('вставка в ячейку остаётся вставкой текста в инпут', () => {
    const { result, sync } = setupTovary()
    const e = pasteEvent('Шкаф\t300', 'input')
    result.current.handlePasteEvent(e)
    expect(sync.replaceRows).not.toHaveBeenCalled()
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(e.preventDefault).not.toHaveBeenCalled()
  })

  it('пустой буфер строк не добавляет', () => {
    const { result, sync } = setupTovary()
    result.current.handlePasteEvent(pasteEvent('   \n'))
    expect(sync.replaceRows).not.toHaveBeenCalled()
  })
})
