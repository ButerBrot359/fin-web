import { afterEach, describe, expect, it } from 'vitest'

import {
  flushAllPendingTableCommits,
  registerPendingFlush,
  unregisterPendingFlush,
} from './pending-table-commits'

describe('flushAllPendingTableCommits', () => {
  let token: symbol

  afterEach(() => unregisterPendingFlush(token))

  it('отклоняется, если хоть один flush отклонился', async () => {
    token = registerPendingFlush(() => Promise.reject(new Error('boom')))
    await expect(flushAllPendingTableCommits()).rejects.toThrow('boom')
  })
})
