import type { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import { buildCommonEffectDeps, type EffectDepsCtx } from './build-effect-deps'

vi.mock('@/shared/api/api', () => ({
  apiService: { get: vi.fn(), post: vi.fn() },
}))

function makeCtx() {
  const invalidateQueries = vi.fn()
  const ctx = {
    navigate: vi.fn(),
    session: { getSession: () => ({ formSessionId: null }) },
    queryClient: { invalidateQueries } as unknown as QueryClient,
    setSearchParams: vi.fn(),
  } as unknown as EffectDepsCtx
  return { ctx, invalidateQueries }
}

describe('invalidateLists', () => {
  const invalidatedKeys = (invalidateQueries: ReturnType<typeof vi.fn>) =>
    invalidateQueries.mock.calls.map(([arg]: [{ queryKey: unknown }]) =>
      JSON.stringify(arg.queryKey)
    )

  it('инвалидирует SDUI-списки (контракт ADR-0035)', () => {
    const { ctx, invalidateQueries } = makeCtx()
    buildCommonEffectDeps(ctx).invalidateLists()
    expect(invalidatedKeys(invalidateQueries)).toContain('["sdui-list"]')
  })

  it('инвалидирует легаси-кэши справочника: список, карточка, сайдбар', () => {
    const { ctx, invalidateQueries } = makeCtx()
    buildCommonEffectDeps(ctx).invalidateLists()
    const keys = invalidatedKeys(invalidateQueries)
    for (const key of [
      '["dict-entries"]',
      '["dict-entry"]',
      '["dict-sidebar-entries"]',
      '["dict-sidebar-entry"]',
    ]) {
      expect(keys).toContain(key)
    }
  })
})
