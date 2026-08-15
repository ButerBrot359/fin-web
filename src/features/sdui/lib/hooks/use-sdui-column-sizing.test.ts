import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../types/view'
import { useSduiColumnSizing } from './use-sdui-column-sizing'

const TABLE_ID = 'table.tmz'
const STATE_KEY = 'doc:PeremeshchenieTMZ.TMZ'
const STORAGE_KEY = `sdui-col-widths:${STATE_KEY}`

const makeNode = (props: Record<string, unknown>): ViewNode =>
  ({
    id: TABLE_ID,
    type: 'TABLE',
    binding: 'TMZ',
    props,
    children: [
      {
        id: `${TABLE_ID}.col.nomenklatura`,
        type: 'TABLE_COLUMN',
        props: { label: 'Номенклатура' },
      },
      {
        id: `${TABLE_ID}.col.summa`,
        type: 'TABLE_COLUMN',
        props: { label: 'Сумма' },
      },
    ],
  }) as ViewNode

const resizableNode = makeNode({
  editable: true,
  columnsResizable: true,
  columnStateKey: STATE_KEY,
})

const stored = (): unknown =>
  JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useSduiColumnSizing — контракт бэка', () => {
  it('columnsResizable + columnStateKey → ресайз включён', () => {
    const { result } = renderHook(() => useSduiColumnSizing(resizableNode))
    expect(result.current.isResizable).toBe(true)
    expect(result.current.enableColumnResizing).toBe(true)
    expect(result.current.columnResizeMode).toBe('onChange')
  })

  it('без columnsResizable — выключено и в localStorage не пишем', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ 'col.nomenklatura': 300 })
    )
    const { result } = renderHook(() =>
      useSduiColumnSizing(
        makeNode({ editable: true, columnStateKey: STATE_KEY })
      )
    )
    expect(result.current.isResizable).toBe(false)
    expect(result.current.enableColumnResizing).toBe(false)
    expect(result.current.columnSizing).toEqual({})

    act(() => {
      result.current.setColumnWidth(`${TABLE_ID}.col.nomenklatura`, 111)
    })
    expect(result.current.columnSizing).toEqual({})
    // Чужая карта не тронута — выключенный хук ничего не пишет.
    expect(stored()).toEqual({ 'col.nomenklatura': 300 })
  })

  it('columnsResizable без columnStateKey — выключено', () => {
    const { result } = renderHook(() =>
      useSduiColumnSizing(makeNode({ columnsResizable: true }))
    )
    expect(result.current.isResizable).toBe(false)
  })
})

describe('useSduiColumnSizing — гидрация и запись', () => {
  it('гидрируется из localStorage, раскрывая относительные ключи в id колонок', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ 'col.nomenklatura': 320, 'col.unknown': 99 })
    )
    const { result } = renderHook(() => useSduiColumnSizing(resizableNode))
    // Ключ неизвестной колонки в состояние таблицы не попадает…
    expect(result.current.columnSizing).toEqual({
      [`${TABLE_ID}.col.nomenklatura`]: 320,
    })
    // …но и не теряется: сервер может показать эту колонку позже.
    act(() => {
      result.current.setColumnWidth(`${TABLE_ID}.col.summa`, 90)
    })
    expect(stored()).toEqual({
      'col.nomenklatura': 320,
      'col.unknown': 99,
      'col.summa': 90,
    })
  })

  it('onColumnSizingChange пишет карту ОТНОСИТЕЛЬНЫХ ключей', () => {
    const { result } = renderHook(() => useSduiColumnSizing(resizableNode))

    act(() => {
      result.current.onColumnSizingChange((prev) => ({
        ...prev,
        [`${TABLE_ID}.col.summa`]: 210,
      }))
    })

    expect(result.current.columnSizing).toEqual({
      [`${TABLE_ID}.col.summa`]: 210,
    })
    expect(stored()).toEqual({ 'col.summa': 210 })
    expect(result.current.getColumnWidth(`${TABLE_ID}.col.summa`)).toBe(210)
  })

  it('смена columnStateKey перечитывает свою карту', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ 'col.summa': 210 }))
    localStorage.setItem(
      'sdui-col-widths:list:DICTIONARY:Nomenklatura',
      JSON.stringify({ 'col.summa': 500 })
    )

    const { result, rerender } = renderHook(
      (props: { stateKey: string }) =>
        useSduiColumnSizing(
          makeNode({ columnsResizable: true, columnStateKey: props.stateKey })
        ),
      { initialProps: { stateKey: STATE_KEY } }
    )
    expect(result.current.columnSizing).toEqual({
      [`${TABLE_ID}.col.summa`]: 210,
    })

    rerender({ stateKey: 'list:DICTIONARY:Nomenklatura' })
    expect(result.current.columnSizing).toEqual({
      [`${TABLE_ID}.col.summa`]: 500,
    })
  })
})

describe('useSduiColumnSizing — устойчивость', () => {
  it.each([
    ['битый JSON', '{не json'],
    ['не объект', '"строка"'],
    ['массив', '[1,2,3]'],
    ['null', 'null'],
  ])('мусор в localStorage (%s) игнорируется', (_case, raw) => {
    localStorage.setItem(STORAGE_KEY, raw)
    const { result } = renderHook(() => useSduiColumnSizing(resizableNode))
    expect(result.current.columnSizing).toEqual({})
    expect(result.current.isResizable).toBe(true)
  })

  it('не-числовые и неположительные ширины отбрасываются', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        'col.nomenklatura': '320',
        'col.summa': 0,
      })
    )
    const { result } = renderHook(() => useSduiColumnSizing(resizableNode))
    expect(result.current.columnSizing).toEqual({})
  })

  it('недоступный localStorage (private mode) — ресайз работает без персиста', () => {
    const getItem = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('SecurityError')
      })
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('SecurityError')
      })

    const { result } = renderHook(() => useSduiColumnSizing(resizableNode))
    expect(result.current.isResizable).toBe(true)

    act(() => {
      result.current.setColumnWidth(`${TABLE_ID}.col.summa`, 260)
    })
    // Ширина живёт в состоянии сессии, исключение наружу не вылетело.
    expect(result.current.columnSizing).toEqual({
      [`${TABLE_ID}.col.summa`]: 260,
    })
    expect(getItem).toHaveBeenCalled()
    expect(setItem).toHaveBeenCalled()
  })
})
