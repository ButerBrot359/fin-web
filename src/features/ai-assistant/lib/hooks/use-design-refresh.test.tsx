import type { ReactNode } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { AiAssistantAnswer } from '@/entities/ai-assistant'
import { subscribeViewSettingsChanged } from '@/shared/lib/design-settings/design-settings-events'

import { useDesignRefresh } from './use-design-refresh'

const answer = (flags: Partial<AiAssistantAnswer>): AiAssistantAnswer => ({
  conversationId: 1,
  conclusion: '',
  breakdown: [],
  sources: [],
  actions: [],
  created: [],
  latencyMs: 0,
  ...flags,
})

const setup = () => {
  const queryClient = new QueryClient()
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useDesignRefresh(), { wrapper })
  return { refresh: result.current, invalidate }
}

describe('useDesignRefresh', () => {
  it('viewSettingsChanged → шина + инвалидация списков SDUI', () => {
    const { refresh, invalidate } = setup()
    const listener = vi.fn()
    const unsubscribe = subscribeViewSettingsChanged(listener)

    refresh(answer({ viewSettingsChanged: true }))

    expect(listener).toHaveBeenCalledTimes(1)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['sdui-list'] })
    unsubscribe()
  })

  it('themeChanged → инвалидация слитой темы', () => {
    const { refresh, invalidate } = setup()

    refresh(answer({ themeChanged: true }))

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['theme', 'merged'] })
  })

  it('без флагов (старый бэк) — ничего не происходит', () => {
    const { refresh, invalidate } = setup()
    const listener = vi.fn()
    const unsubscribe = subscribeViewSettingsChanged(listener)

    refresh(answer({}))

    expect(listener).not.toHaveBeenCalled()
    expect(invalidate).not.toHaveBeenCalled()
    unsubscribe()
  })
})
