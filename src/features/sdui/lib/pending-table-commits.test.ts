import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  registerPendingFlush,
  unregisterPendingFlush,
  flushAllPendingTableCommits,
  FLUSH_TIMEOUT_MS,
} from './pending-table-commits'

describe('flushAllPendingTableCommits', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('резолвится по таймауту, если flush завис навсегда', async () => {
    vi.useFakeTimers()
    const token = registerPendingFlush(() => new Promise<void>(() => {}))
    const promise = flushAllPendingTableCommits()
    await vi.advanceTimersByTimeAsync(FLUSH_TIMEOUT_MS)
    await expect(promise).resolves.toBeUndefined()
    unregisterPendingFlush(token)
  })

  it('пробрасывает reject от flush (ошибка сети) раньше таймаута', async () => {
    const token = registerPendingFlush(() =>
      Promise.reject(new Error('table commit failed')),
    )
    await expect(flushAllPendingTableCommits()).rejects.toThrow(
      'table commit failed',
    )
    unregisterPendingFlush(token)
  })

  it('резолвится сразу, когда все flush завершились до таймаута', async () => {
    const token = registerPendingFlush(() => Promise.resolve())
    await expect(flushAllPendingTableCommits()).resolves.toBeUndefined()
    unregisterPendingFlush(token)
  })
})
