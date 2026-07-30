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

  // SCRUM-314 §6: раньше зависший flush по таймауту РЕЗОЛВИЛСЯ — save уходил по
  // старому состоянию, введённое пользователем молча пропадало. Теперь отказ
  // видимый: dispatch ловит reject и показывает тост, save не выполняется.
  it('реджектится по таймауту, если flush завис навсегда', async () => {
    vi.useFakeTimers()
    const token = registerPendingFlush(() => new Promise<void>(() => undefined))
    // Обработчик отказа навешиваем ДО прокрутки таймеров: иначе reject
    // происходит раньше, чем на промис кто-то подписался, и Node сообщает об
    // необработанном отклонении — vitest считает это ошибкой прогона.
    const rejects = expect(flushAllPendingTableCommits()).rejects.toThrow(
      'table flush timed out'
    )
    await vi.advanceTimersByTimeAsync(FLUSH_TIMEOUT_MS)
    await rejects
    unregisterPendingFlush(token)
  })

  it('пробрасывает reject от flush (ошибка сети) раньше таймаута', async () => {
    const token = registerPendingFlush(() =>
      Promise.reject(new Error('table commit failed'))
    )
    await expect(flushAllPendingTableCommits()).rejects.toThrow(
      'table commit failed'
    )
    unregisterPendingFlush(token)
  })

  it('резолвится сразу, когда все flush завершились до таймаута', async () => {
    const token = registerPendingFlush(() => Promise.resolve())
    await expect(flushAllPendingTableCommits()).resolves.toBeUndefined()
    unregisterPendingFlush(token)
  })
})
