import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAiConversationMessages } from './use-ai-assistant'

const api = vi.hoisted(() => ({ getConversationMessages: vi.fn() }))
vi.mock('../../api/ai-assistant-api', () => ({ aiAssistantApi: api }))
const rows = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, index) => ({
    id: from + index,
    role: 'ASSISTANT',
    content: `Сообщение ${String(from + index)}`,
    createdAt: '',
  }))

describe('conversation pages', () => {
  beforeEach(() => {
    api.getConversationMessages.mockReset()
  })
  it('загружает только последнюю страницу, затем старую по курсору', async () => {
    api.getConversationMessages.mockResolvedValueOnce({
      messages: rows(11, 20),
      hasMore: true,
      nextBeforeId: 11,
    })
    api.getConversationMessages.mockResolvedValueOnce({
      messages: rows(1, 10),
      hasMore: false,
      nextBeforeId: null,
    })
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const { result, rerender } = renderHook(
      ({ enabled }) => useAiConversationMessages(42, enabled),
      { wrapper, initialProps: { enabled: true } }
    )
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.messages.map((message) => message.id)).toEqual(
      Array.from({ length: 10 }, (_, i) => i + 11)
    )
    expect(api.getConversationMessages).toHaveBeenCalledTimes(1)
    rerender({ enabled: false })
    act(() => {
      result.current.loadOlder()
      result.current.loadOlder()
    })
    await waitFor(() => {
      expect(result.current.messages).toHaveLength(20)
    })
    expect(api.getConversationMessages).toHaveBeenCalledTimes(2)
    expect(api.getConversationMessages.mock.calls[1][2]).toBe(11)
    expect(result.current.messages[0].id).toBe(1)
    expect(result.current.hasOlderMessages).toBe(false)
    client.clear()
  })
})
