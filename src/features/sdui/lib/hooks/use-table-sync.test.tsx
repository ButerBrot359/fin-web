import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../types/view'
import { useTableSync } from './use-table-sync'

const mockDispatch = vi.fn(() => Promise.resolve(true))
vi.mock('../dispatch', () => ({
  useSduiDispatch: () => mockDispatch,
}))

const sessionState: Record<string, unknown> = {}
vi.mock('../sdui-session-context', () => ({
  useSduiSession: () => ({
    getValue: (b?: string) => (b ? sessionState[b] : undefined),
    setValue: (b: string, v: unknown) => {
      sessionState[b] = v
    },
  }),
}))

const node = { id: 'tbl', type: 'TABLE', binding: 'rows' } as ViewNode

describe('useTableSync', () => {
  it('не зацикливается, когда canon-значение отсутствует в сторе', () => {
    delete sessionState.rows
    // При баге C1 renderHook падает с "Maximum update depth exceeded"
    const { result, rerender } = renderHook(() => useTableSync(node, []))
    rerender()
    expect(result.current.rows).toEqual([])
  })
})
