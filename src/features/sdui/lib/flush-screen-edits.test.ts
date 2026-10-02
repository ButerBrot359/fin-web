import { renderHook, act, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { acquireFormTurn } from './form-dispatch-queue'
import { flushScreenEdits, hasPendingScreenEdits } from './flush-screen-edits'
import { useChangeOnBlur } from './hooks/use-change-on-blur'
import {
  registerPendingFlush,
  unregisterPendingFlush,
} from './pending-table-commits'
import { useTreeStore } from './stores/tree-store'

describe('flushScreenEdits (D7/D8)', () => {
  afterEach(() => {
    cleanup()
    useTreeStore.getState().reset()
  })

  it('набранное, но не ушедшее значение поля и правка ТЧ отправляются до ухода с экрана', async () => {
    const fire = vi.fn()
    const { result, rerender } = renderHook(
      ({ value }) => useChangeOnBlur({ fireServerEvent: fire }, value),
      { initialProps: { value: '' } }
    )
    act(() => {
      result.current.onFocus()
    })
    rerender({ value: '150' })
    let tablePending = true
    const tableFlush = vi.fn(() => {
      tablePending = false
      return Promise.resolve()
    })
    const token = registerPendingFlush(tableFlush, () => tablePending)

    expect(hasPendingScreenEdits()).toBe(true)
    await flushScreenEdits()

    expect(fire).toHaveBeenCalledExactlyOnceWith('change', '150')
    expect(tableFlush).toHaveBeenCalledOnce()
    expect(hasPendingScreenEdits()).toBe(false)

    act(() => {
      result.current.onBlur()
    })
    expect(fire).toHaveBeenCalledOnce()
    unregisterPendingFlush(token)
  })

  it('ждёт, пока очередь формы обработает уже отправленные события', async () => {
    useTreeStore.getState().setSession('fs-flush', 1)
    const release = await acquireFormTurn('fs-flush')
    let done = false
    const pending = flushScreenEdits().then(() => {
      done = true
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(done).toBe(false)

    release()
    await pending
    expect(done).toBe(true)
  })
})
