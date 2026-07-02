import { afterEach, describe, expect, it } from 'vitest'

import {
  flushAllPendingTableCommits,
  registerPendingFlush,
  unregisterPendingFlush,
} from './pending-table-commits'

describe('flushAllPendingTableCommits', () => {
  afterEach(() => unregisterPendingFlush('t'))

  it('отклоняется, если хоть один flush отклонился', async () => {
    registerPendingFlush('t', () => Promise.reject(new Error('boom')))
    await expect(flushAllPendingTableCommits()).rejects.toThrow('boom')
  })
})
