import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../types/view'
import { useTreeStore } from '../stores/tree-store'
import { usePendingSaveAndClose } from './use-pending-save-and-close'

const ROUTE = '/documents/X/1'
const root = { id: 'root', type: 'PAGE' } as unknown as ViewNode

const setup = (pendingAction: string | null = 'save-and-close') => {
  let pending: string | null = pendingAction
  const dispatch = vi.fn(() => Promise.resolve(true))
  const consumePendingAction = vi.fn(() => {
    const action = pending
    pending = null
    return action
  })
  const onSavedAndClosed = vi.fn()
  const onSaveAndCloseFailed = vi.fn()
  const hook = renderHook(
    ({ action }: { action: string | null }) => {
      usePendingSaveAndClose({
        screenRoute: ROUTE,
        dispatch: dispatch as never,
        pendingAction: action,
        consumePendingAction,
        onSavedAndClosed,
        onSaveAndCloseFailed,
      })
    },
    { initialProps: { action: pendingAction } }
  )
  return {
    hook,
    dispatch,
    consumePendingAction,
    onSavedAndClosed,
    onSaveAndCloseFailed,
    setPending: (a: string | null) => {
      pending = a
    },
  }
}

describe('usePendingSaveAndClose (D5)', () => {
  afterEach(() => {
    cleanup()
    useTreeStore.getState().reset()
  })

  it('после F5: pending не теряется на монтировании, save-and-close уходит после OPEN с onDirtyClose', async () => {
    const t = setup()

    expect(t.consumePendingAction).not.toHaveBeenCalled()
    expect(t.dispatch).not.toHaveBeenCalled()

    act(() => {
      useTreeStore.getState().setRoot(root)
      useTreeStore.getState().setOnDirtyClose({
        actionId: 'command',
        command: 'saveAndClose',
        behavior: { closeAfter: true },
      } as never)
    })

    expect(t.dispatch).toHaveBeenCalledExactlyOnceWith(
      { type: 'COMMAND', command: 'saveAndClose' },
      { closeAfter: true }
    )
    await vi.waitFor(() => {
      expect(t.onSavedAndClosed).toHaveBeenCalledWith(ROUTE)
    })
  })

  it('активная вкладка: pending, выставленный после монтирования, подхватывается', () => {
    act(() => {
      useTreeStore.getState().setRoot(root)
      useTreeStore.getState().setOnDirtyClose({
        actionId: 'command',
        command: 'save',
      } as never)
    })
    const t = setup(null)
    expect(t.dispatch).not.toHaveBeenCalled()

    t.setPending('save-and-close')
    t.hook.rerender({ action: 'save-and-close' })

    expect(t.dispatch).toHaveBeenCalledOnce()
  })

  it('форма открылась без дескриптора сохранения — сообщает о неудаче', () => {
    const t = setup()
    act(() => {
      useTreeStore.getState().setRoot(root)
    })

    expect(t.dispatch).not.toHaveBeenCalled()
    expect(t.onSaveAndCloseFailed).toHaveBeenCalledWith(ROUTE)
  })

  it('сохранение не прошло — сообщает о неудаче, вкладку не закрывает', async () => {
    const t = setup()
    t.dispatch.mockResolvedValueOnce(false)
    act(() => {
      useTreeStore.getState().setRoot(root)
      useTreeStore.getState().setOnDirtyClose({
        actionId: 'command',
        command: 'save',
      } as never)
    })

    await vi.waitFor(() => {
      expect(t.onSaveAndCloseFailed).toHaveBeenCalledWith(ROUTE)
    })
    expect(t.onSavedAndClosed).not.toHaveBeenCalled()
  })
})
