import type { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import { buildCommonEffectDeps, type EffectDepsCtx } from './build-effect-deps'
import { consumeFreshFormInstance } from './fresh-form-instance'

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
    (invalidateQueries.mock.calls as { queryKey: unknown }[][]).map((call) =>
      JSON.stringify(call[0].queryKey)
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

describe('openRouteInNewTab', () => {
  it('переход в отчёт начинает новый экземпляр формы: открытая вкладка отчёта не отдаёт старые параметры', () => {
    const { ctx } = makeCtx()
    const route =
      '/modules/Otchety/reportalt/KartochkaScheta?rp=r1.eyJwYXJhbWV0ZXJzIjp7fX0'

    buildCommonEffectDeps(ctx).openRouteInNewTab(route)

    expect(ctx.navigate).toHaveBeenCalledWith(route)
    expect(
      consumeFreshFormInstance('/modules/Otchety/reportalt/KartochkaScheta')
    ).toBe(true)
  })

  it('переход на карточку существующего документа черновик вкладки не сбрасывает', () => {
    const { ctx } = makeCtx()
    const route = '/modules/Buhgalteriya/document/SchetKOplate/42'

    buildCommonEffectDeps(ctx).openRouteInNewTab(route)

    expect(consumeFreshFormInstance(route)).toBe(false)
  })
})
