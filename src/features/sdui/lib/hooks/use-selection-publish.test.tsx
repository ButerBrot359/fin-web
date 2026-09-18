import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ViewAction, ViewNode } from '../../types/view'
import { useSelectionPublish, type SelectionRow } from './use-selection-publish'

// Очередь EVENT'ов списка-ОТБОРА: dispatch.ts гардит от параллельных запросов
// только COMMAND, поэтому порядок ответов на EVENT гарантирует сама очередь
// промисов хука (см. комментарий у pendingRef в use-selection-publish.ts).

const row = (id: string): SelectionRow => ({ rowId: id, Sotrudnik: id })

const makeNode = (withEvent: boolean): ViewNode => ({
  id: 'sel-1',
  type: 'TABLE',
  binding: 'otbor',
  actions: withEvent
    ? [{ trigger: 'change', actionId: 'fieldEvent' }]
    : undefined,
})

const setup = (opts: {
  withEvent: boolean
  dispatch: (action: ViewAction) => Promise<unknown>
}) => {
  const setFromServer = vi.fn()
  const hook = renderHook(() =>
    useSelectionPublish({
      node: makeNode(opts.withEvent),
      rows: [row('r1'), row('r2')],
      rowLabel: (r) => r.rowId,
      setFromServer,
      dispatch: opts.dispatch,
    })
  )
  return { ...hook, setFromServer }
}

const flushMicrotasks = () =>
  act(async () => {
    await Promise.resolve()
  })

describe('useSelectionPublish (очередь EVENT)', () => {
  it('свободная очередь: EVENT публикуется сразу, сессия и выбор обновлены', async () => {
    const dispatch = vi.fn().mockResolvedValue(true)
    const { result, setFromServer } = setup({ withEvent: true, dispatch })

    act(() => {
      result.current.publish(row('r1'))
    })
    await flushMicrotasks()

    expect(result.current.selectedRowId).toBe('r1')
    expect(setFromServer).toHaveBeenCalledWith('otbor.__selectedRowId', 'r1')
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({
      type: 'EVENT',
      sourceNodeId: 'sel-1',
      trigger: 'change',
      value: row('r1'),
    })
  })

  it('занятая очередь: EVENT копится в pending и дренируется строго в порядке кликов', async () => {
    const resolvers: (() => void)[] = []
    const dispatch = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolvers.push(() => {
            resolve(true)
          })
        })
    )
    const { result } = setup({ withEvent: true, dispatch })

    act(() => {
      result.current.publish(row('r1'))
      result.current.publish(row('r2'))
      result.current.publish(null)
    })
    await flushMicrotasks()

    // Уходит только первый EVENT; второй и третий ждут в pending.
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ value: row('r1') })
    )

    await act(async () => {
      resolvers[0]()
      await Promise.resolve()
    })
    expect(dispatch).toHaveBeenCalledTimes(2)
    expect(dispatch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ value: row('r2') })
    )

    await act(async () => {
      resolvers[1]()
      await Promise.resolve()
    })
    expect(dispatch).toHaveBeenCalledTimes(3)
    expect(dispatch).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ value: null })
    )
  })

  it('без change/fieldEvent-экшена EVENT не уходит, но сессия публикуется', async () => {
    const dispatch = vi.fn().mockResolvedValue(true)
    const { result, setFromServer } = setup({ withEvent: false, dispatch })

    act(() => {
      result.current.publish(row('r2'))
    })
    await flushMicrotasks()

    expect(setFromServer).toHaveBeenCalledWith('otbor.__selectedRowId', 'r2')
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('publish(null) снимает отбор: null в сессию, выбор сброшен', async () => {
    const dispatch = vi.fn().mockResolvedValue(true)
    const { result, setFromServer } = setup({ withEvent: true, dispatch })

    act(() => {
      result.current.publish(row('r1'))
    })
    act(() => {
      result.current.publish(null)
    })
    await flushMicrotasks()

    expect(result.current.selectedRowId).toBeNull()
    expect(result.current.selectedOption).toBeNull()
    expect(setFromServer).toHaveBeenLastCalledWith(
      'otbor.__selectedRowId',
      null
    )
  })
})
