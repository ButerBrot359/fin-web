import { describe, expect, it, vi } from 'vitest'

import {
  runAfterTabLeaveFlush,
  setTabLeaveFlush,
} from './tab-leave-flush-registry'

describe('tab-leave-flush-registry (D7/D8)', () => {
  it('без хоста и без незавершённых правок действие выполняется синхронно', () => {
    const action = vi.fn()
    runAfterTabLeaveFlush(action)
    expect(action).toHaveBeenCalledOnce()

    const off = setTabLeaveFlush({
      hasPending: () => false,
      flush: () => Promise.reject(new Error('не должен вызываться')),
    })
    runAfterTabLeaveFlush(action)
    expect(action).toHaveBeenCalledTimes(2)
    off()
  })

  it('с незавершёнными правками действие ждёт flush, и выполняется даже при его ошибке', async () => {
    let resolve: () => void = () => undefined
    const off = setTabLeaveFlush({
      hasPending: () => true,
      flush: () =>
        new Promise<void>((r) => {
          resolve = r
        }),
    })
    const action = vi.fn()
    runAfterTabLeaveFlush(action)
    expect(action).not.toHaveBeenCalled()
    resolve()
    await vi.waitFor(() => {
      expect(action).toHaveBeenCalledOnce()
    })
    off()

    const offFail = setTabLeaveFlush({
      hasPending: () => true,
      flush: () => Promise.reject(new Error('flush failed')),
    })
    const after = vi.fn()
    runAfterTabLeaveFlush(after)
    await vi.waitFor(() => {
      expect(after).toHaveBeenCalledOnce()
    })
    offFail()
  })
})
