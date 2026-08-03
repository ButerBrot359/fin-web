import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../types/view'
import { useRowActivate } from './use-row-activate'

const mockDispatch = vi.fn<(action: unknown, behavior?: unknown) => Promise<boolean>>(
  () => Promise.resolve(true),
)
vi.mock('../dispatch', () => ({
  useSduiDispatch: () => mockDispatch,
}))

// Значение по binding таблицы задаётся тестом: смена ссылки массива = серверный setValue.
const state: Record<string, unknown> = {}
vi.mock('../sdui-session-context', () => ({
  useBindingValue: (b?: string) => (b ? state[b] : undefined),
}))

const behavior = {
  flushPendingTables: false,
  resetsDirty: false,
  closeAfter: false,
}

const nodeWithActivate: ViewNode = {
  id: 'table.vychetyIPN',
  type: 'TABLE',
  binding: 'VychetyIPN',
  props: { editable: true, rowActivate: true },
  actions: [
    { trigger: 'change', actionId: 'fieldEvent' },
    {
      trigger: 'activate',
      actionId: 'command',
      command: 'table.rowActivate:VychetyIPN',
      behavior,
    },
  ],
} as ViewNode

const nodeWithoutActivate: ViewNode = {
  id: 'table.grafikPlatezhey',
  type: 'TABLE',
  binding: 'GrafikPlatezhey',
  props: { editable: true },
  actions: [{ trigger: 'change', actionId: 'fieldEvent' }],
} as ViewNode

beforeEach(() => {
  state.VychetyIPN = [{ rowId: 'r1' }, { rowId: 'r2' }]
  mockDispatch.mockClear()
})

describe('useRowActivate', () => {
  it('шлёт готовую команду бэка с rowId и его behavior', () => {
    const { result } = renderHook(() => useRowActivate(nodeWithActivate))

    act(() => {
      result.current('r1')
    })

    expect(mockDispatch).toHaveBeenCalledExactlyOnceWith(
      {
        type: 'COMMAND',
        command: 'table.rowActivate:VychetyIPN',
        value: { rowId: 'r1' },
      },
      behavior,
    )
  })

  it('повторная активация той же строки round-trip не порождает', () => {
    const { result } = renderHook(() => useRowActivate(nodeWithActivate))

    act(() => {
      result.current('r1')
    })
    act(() => {
      result.current('r1')
    })

    expect(mockDispatch).toHaveBeenCalledTimes(1)
  })

  it('переход на другую строку и обратно — по запросу на каждую смену', () => {
    const { result } = renderHook(() => useRowActivate(nodeWithActivate))

    act(() => {
      result.current('r1')
    })
    act(() => {
      result.current('r2')
    })
    act(() => {
      result.current('r1')
    })

    expect(mockDispatch).toHaveBeenCalledTimes(3)
  })

  it('новый массив строк по binding сбрасывает дедуп — прежний rowId мог исчезнуть', () => {
    const { result, rerender } = renderHook(() => useRowActivate(nodeWithActivate))

    act(() => {
      result.current('r1')
    })
    expect(mockDispatch).toHaveBeenCalledTimes(1)

    state.VychetyIPN = [{ rowId: 'r1' }] // серверный setValue по binding таблицы
    rerender()

    act(() => {
      result.current('r1')
    })
    expect(mockDispatch).toHaveBeenCalledTimes(2)
  })

  it('нет action с trigger=activate → клик по строке на сервер не ходит', () => {
    const { result } = renderHook(() => useRowActivate(nodeWithoutActivate))

    act(() => {
      result.current('r1')
    })

    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('есть props.rowActivate, но action не пришёл → команду не конструируем', () => {
    const broken = {
      ...nodeWithoutActivate,
      props: { editable: true, rowActivate: true },
    } as ViewNode
    const { result } = renderHook(() => useRowActivate(broken))

    act(() => {
      result.current('r1')
    })

    expect(mockDispatch).not.toHaveBeenCalled()
  })
})
