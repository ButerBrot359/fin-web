import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAiConversationPages } from './use-ai-conversation-pages'

const api = vi.hoisted(() => ({ getConversationPage: vi.fn() }))
vi.mock('../../api/ai-assistant-api', () => ({ aiAssistantApi: api }))
const clients: QueryClient[] = []
const rows = (newest: number, count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: newest - i,
    title: `Чат ${String(newest - i)}`,
    createdAt: '2026-09-10T10:00:00+05:00',
  }))
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  clients.push(client)
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return renderHook(() => useAiConversationPages(), { wrapper })
}

describe('conversation list cursor pages', () => {
  beforeEach(() => api.getConversationPage.mockReset())
  afterEach(() => {
    clients.splice(0).forEach((client) => {
      client.clear()
    })
  })

  it('loads 25 chats in three explicit pages without duplicate simultaneous requests', async () => {
    api.getConversationPage
      .mockResolvedValueOnce({
        conversations: rows(25, 10),
        hasMore: true,
        nextBeforeId: 16,
      })
      .mockResolvedValueOnce({
        conversations: rows(15, 10),
        hasMore: true,
        nextBeforeId: 6,
      })
      .mockResolvedValueOnce({
        conversations: rows(5, 5),
        hasMore: false,
        nextBeforeId: null,
      })
    const { result } = setup()
    await waitFor(() => {
      expect(result.current.conversations).toHaveLength(10)
    })
    expect(api.getConversationPage).toHaveBeenCalledTimes(1)
    expect(api.getConversationPage.mock.calls[0][0]).toBeNull()
    expect(api.getConversationPage.mock.calls[0][1]).toBeInstanceOf(AbortSignal)
    act(() => {
      result.current.loadMore()
      result.current.loadMore()
    })
    await waitFor(() => {
      expect(result.current.conversations).toHaveLength(20)
    })
    expect(api.getConversationPage).toHaveBeenCalledTimes(2)
    expect(api.getConversationPage.mock.calls[1][0]).toBe(16)
    act(() => {
      result.current.loadMore()
    })
    await waitFor(() => {
      expect(result.current.conversations).toHaveLength(25)
    })
    expect(api.getConversationPage.mock.calls[2][0]).toBe(6)
    expect(result.current.conversations.map((row) => row.id)).toEqual(
      rows(25, 25).map((row) => row.id)
    )
    expect(result.current.hasMore).toBe(false)
    act(() => {
      result.current.loadMore()
    })
    expect(api.getConversationPage).toHaveBeenCalledTimes(3)
  })

  it('deduplicates overlapping pages while preserving server order', async () => {
    api.getConversationPage
      .mockResolvedValueOnce({
        conversations: rows(12, 10),
        hasMore: true,
        nextBeforeId: 3,
      })
      .mockResolvedValueOnce({
        conversations: rows(3, 3),
        hasMore: false,
        nextBeforeId: null,
      })
    const { result } = setup()
    await waitFor(() => {
      expect(result.current.conversations).toHaveLength(10)
    })
    act(() => {
      result.current.loadMore()
    })
    await waitFor(() => {
      expect(result.current.conversations).toHaveLength(12)
    })
    expect(result.current.conversations.map((row) => row.id)).toEqual(
      rows(12, 12).map((row) => row.id)
    )
  })

  it('retries a failed initial load and exposes an empty completed history', async () => {
    api.getConversationPage
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({
        conversations: [],
        hasMore: false,
        nextBeforeId: null,
      })
    const { result } = setup()
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    act(() => {
      result.current.retry()
    })
    await waitFor(() => {
      expect(result.current.isError).toBe(false)
    })
    await waitFor(() => {
      expect(result.current.isFetching).toBe(false)
    })
    expect(result.current.conversations).toEqual([])
    expect(result.current.hasMore).toBe(false)
  })

  it('retains loaded chats when an older page fails and retries the same cursor', async () => {
    api.getConversationPage
      .mockResolvedValueOnce({
        conversations: rows(25, 10),
        hasMore: true,
        nextBeforeId: 16,
      })
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({
        conversations: rows(15, 10),
        hasMore: false,
        nextBeforeId: null,
      })
    const { result } = setup()
    await waitFor(() => {
      expect(result.current.conversations).toHaveLength(10)
    })
    act(() => {
      result.current.loadMore()
    })
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.conversations).toHaveLength(10)
    act(() => {
      result.current.loadMore()
    })
    await waitFor(() => {
      expect(result.current.conversations).toHaveLength(20)
    })
    expect(
      api.getConversationPage.mock.calls
        .slice(1)
        .map((call) => call[0] as number)
    ).toEqual([16, 16])
  })
})
