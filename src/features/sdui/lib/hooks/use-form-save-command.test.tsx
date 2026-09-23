import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNodeAction } from '../../types/view'
import { useTreeStore } from '../stores/tree-store'
import { useFormSaveCommand } from './use-form-save-command'

const mockDispatch = vi.fn(() => Promise.resolve(true))
vi.mock('../dispatch', () => ({
  useSduiDispatch: () => mockDispatch,
}))

let sessionKind: 'root' | 'panel' = 'root'
vi.mock('../sdui-session-context', () => ({
  useSduiSession: () => ({ kind: sessionKind }),
  useBindingValue: () => undefined,
}))

const opisatel: ViewNodeAction = {
  trigger: 'click',
  actionId: 'command',
  command: 'save',
  behavior: { flushPendingTables: true, resetsDirty: true, closeAfter: true },
}

describe('useFormSaveCommand (Ctrl+S из табличной части)', () => {
  beforeEach(() => {
    mockDispatch.mockClear()
    sessionKind = 'root'
    useTreeStore.getState().setOnDirtyClose(opisatel)
  })

  it('команда записи берётся из серверного дескриптора, вкладка не закрывается', () => {
    const { result } = renderHook(() => useFormSaveCommand())
    result.current()
    expect(mockDispatch).toHaveBeenCalledWith(
      { type: 'COMMAND', command: 'save' },
      { flushPendingTables: true, resetsDirty: true, closeAfter: false }
    )
  })

  it('дескриптора нет (форма без записи) — хоткей молчит', () => {
    useTreeStore.getState().setOnDirtyClose(null)
    const { result } = renderHook(() => useFormSaveCommand())
    result.current()
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('в панели молчит: дескриптор принадлежит root-экрану, не форме строки', () => {
    sessionKind = 'panel'
    const { result } = renderHook(() => useFormSaveCommand())
    result.current()
    expect(mockDispatch).not.toHaveBeenCalled()
  })
})
