import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiStatisticsFilters } from '../../types/ai-statistics'
import { useAiStatistics } from './use-ai-statistics'

const api = vi.hoisted(() => ({ getAiStatistics: vi.fn() }))
vi.mock('../../api/analytics-api', () => ({ analyticsApi: api }))

const filters: AiStatisticsFilters = {
  from: '2026-09-01',
  to: '2026-09-10',
  groupBy: 'DAY',
  surface: 'ALL',
}
const clients: QueryClient[] = []
const wrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  clients.push(client)
  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

describe('AI statistics filters and refresh', () => {
  beforeEach(() => {
    api.getAiStatistics.mockReset()
  })
  afterEach(() => {
    cleanup()
    clients.splice(0).forEach((client) => {
      client.clear()
    })
  })

  it('does not show old totals while a different grouping or surface is loading', async () => {
    api.getAiStatistics.mockResolvedValueOnce({ metrics: { requests: 42 } })
    api.getAiStatistics.mockImplementationOnce(
      () => new Promise(() => undefined)
    )
    const { result, rerender } = renderHook(
      (value: AiStatisticsFilters) => useAiStatistics(value),
      {
        wrapper: wrapper(),
        initialProps: filters,
      }
    )
    await waitFor(() => {
      expect(result.current.data?.metrics.requests).toBe(42)
    })
    const selected: AiStatisticsFilters = {
      ...filters,
      groupBy: 'WEEK',
      surface: 'ASSISTANT',
    }
    rerender(selected)
    expect(result.current.data).toBeNull()
    expect(result.current.isLoading).toBe(true)
    expect(api.getAiStatistics).toHaveBeenLastCalledWith(
      selected,
      expect.any(AbortSignal)
    )
  })

  it('cancels an obsolete request when dates change', () => {
    api.getAiStatistics.mockImplementation(() => new Promise(() => undefined))
    const { rerender } = renderHook(
      (value: AiStatisticsFilters) => useAiStatistics(value),
      {
        wrapper: wrapper(),
        initialProps: filters,
      }
    )
    const signal = api.getAiStatistics.mock.calls[0][1] as AbortSignal
    rerender({ ...filters, from: '2026-09-02' })
    expect(signal.aborted).toBe(true)
    expect(api.getAiStatistics).toHaveBeenCalledTimes(2)
  })

  it('reports failures and replaces them with data on explicit retry', async () => {
    api.getAiStatistics.mockRejectedValueOnce(new Error('Unavailable'))
    api.getAiStatistics.mockResolvedValueOnce({ metrics: { requests: 7 } })
    const { result } = renderHook(() => useAiStatistics(filters), {
      wrapper: wrapper(),
    })
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.data).toBeNull()
    await act(async () => {
      await result.current.refetch()
    })
    await waitFor(() => {
      expect(result.current.data?.metrics.requests).toBe(7)
    })
    expect(result.current.isError).toBe(false)
  })
})
