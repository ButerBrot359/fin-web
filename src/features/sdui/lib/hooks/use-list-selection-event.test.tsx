// SCRUM-308 §4.4: selectionChanged уходит только при action с бэка
// (capability-паттерн B-1) и только при выбранной строке.
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../types/view'
import { useListSelectionEvent } from './use-list-selection-event'

const listNode = (withAction: boolean): ViewNode =>
  ({
    id: 'list.Polzovateli.list',
    type: 'LIST',
    actions: withAction
      ? [{ trigger: 'selectionChanged', actionId: 'event' }]
      : [],
  }) as unknown as ViewNode

describe('useListSelectionEvent (SCRUM-308 §4.4)', () => {
  it('со строкой и action шлёт EVENT selectionChanged c {id}', () => {
    const dispatch = vi.fn()
    renderHook(() => {
      useListSelectionEvent(listNode(true), 42, dispatch as never)
    })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'EVENT',
      sourceNodeId: 'list.Polzovateli.list',
      trigger: 'selectionChanged',
      value: { id: 42 },
    })
  })

  it('без action события нет (никакого трафика на остальных списках)', () => {
    const dispatch = vi.fn()
    renderHook(() => {
      useListSelectionEvent(listNode(false), 42, dispatch as never)
    })
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('снятие выделения (null) не шлётся', () => {
    const dispatch = vi.fn()
    renderHook(() => {
      useListSelectionEvent(listNode(true), null, dispatch as never)
    })
    expect(dispatch).not.toHaveBeenCalled()
  })
})
