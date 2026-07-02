import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../types/view'
import { useFieldNode } from './use-field-node'

const mockDispatch = vi.fn(() => Promise.resolve(true))
vi.mock('../dispatch', () => ({ useSduiDispatch: () => mockDispatch }))

const state: Record<string, unknown> = { name: 'Иван' }
vi.mock('../sdui-session-context', () => ({
  useSduiSession: () => ({
    kind: 'panel',
    getSession: () => ({ formSessionId: null, revision: null }),
    getValue: (b?: string) => (b ? state[b] : undefined),
    setValue: (b: string, v: unknown) => {
      state[b] = v
    },
  }),
  useBindingValue: (b?: string) => (b ? state[b] : undefined),
}))

describe('useFieldNode', () => {
  it('извлекает props с дефолтами и значение по binding', () => {
    const node = {
      id: 'f1',
      type: 'TEXT_FIELD',
      binding: 'name',
      props: { label: 'Имя', required: true },
    } as ViewNode
    const { result } = renderHook(() => useFieldNode(node))
    expect(result.current.label).toBe('Имя')
    expect(result.current.required).toBe(true)
    expect(result.current.visible).toBe(true)
    expect(result.current.enabled).toBe(true)
    expect(result.current.value).toBe('Иван')
  })

  it('fireServerEvent диспатчит только при подходящем action', () => {
    const node = {
      id: 'f1',
      type: 'TEXT_FIELD',
      binding: 'name',
      actions: [{ trigger: 'change', actionId: 'fieldEvent' }],
    } as ViewNode
    const { result } = renderHook(() => useFieldNode(node))
    result.current.fireServerEvent('change', 'x')
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'EVENT',
      sourceNodeId: 'f1',
      trigger: 'change',
      value: 'x',
    })
    mockDispatch.mockClear()
    result.current.fireServerEvent('blur', 'x')
    expect(mockDispatch).not.toHaveBeenCalled()
  })
})
