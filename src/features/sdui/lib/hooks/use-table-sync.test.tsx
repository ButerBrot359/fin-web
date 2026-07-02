import { renderHook, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../types/view'
import { useTableSync } from './use-table-sync'

const mockDispatch = vi.fn(() => Promise.resolve(true))
vi.mock('../dispatch', () => ({
  useSduiDispatch: () => mockDispatch,
}))

const sessionState: Record<string, unknown> = {}
vi.mock('../sdui-session-context', () => ({
  useSduiSession: () => ({
    kind: 'panel',
    getSession: () => ({ formSessionId: null, revision: null }),
    getValue: (b?: string) => (b ? sessionState[b] : undefined),
    setValue: (b: string, v: unknown) => {
      sessionState[b] = v
    },
  }),
  useBindingValue: (b?: string) => (b ? sessionState[b] : undefined),
}))

const node = { id: 'tbl', type: 'TABLE', binding: 'rows' } as ViewNode

describe('useTableSync', () => {
  beforeEach(() => {
    delete sessionState.rows
    mockDispatch.mockReset()
    mockDispatch.mockResolvedValue(true)
  })

  it('не зацикливается, когда canon-значение отсутствует в сторе', () => {
    delete sessionState.rows
    // При баге C1 renderHook падает с "Maximum update depth exceeded"
    const { result, rerender } = renderHook(() => useTableSync(node, []))
    rerender()
    expect(result.current.rows).toEqual([])
  })

  it('flushPending отклоняется, если dispatch вернул false (ошибка сети)', async () => {
    delete sessionState.rows
    mockDispatch.mockResolvedValueOnce(false)
    const { result } = renderHook(() => useTableSync(node, []))
    act(() => {
      result.current.updateCell('tmp-x', 'a', 1) // локальное изменение
    })
    await expect(result.current.flushPending()).rejects.toThrow()
  })
})
