import { describe, expect, it, vi } from 'vitest'

import {
  bumpAuthGeneration,
  getAuthGeneration,
  subscribeAuthGeneration,
} from './auth-generation'

describe('auth-generation (SCRUM-400 §10)', () => {
  it('монотонно растёт и уведомляет подписчиков', () => {
    const before = getAuthGeneration()
    const listener = vi.fn()
    const unsubscribe = subscribeAuthGeneration(listener)
    bumpAuthGeneration()
    expect(getAuthGeneration()).toBe(before + 1)
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    bumpAuthGeneration()
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
