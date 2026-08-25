import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../types/view'
import { usePagedTableRows } from './use-paged-table-rows'

const fetchListPage = vi.fn()
vi.mock('../../api/reference-options', () => ({
  fetchListPage: (args: unknown) => fetchListPage(args) as unknown,
}))

const getValue = vi.fn()
vi.mock('../sdui-session-context', () => ({
  useSduiSession: () => ({ getValue }),
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const pagedNode: ViewNode = {
  id: 'movements',
  type: 'TABLE',
  binding: 'movements',
  props: {
    pagination: {
      mode: 'PAGED',
      pageSize: 2,
      source: { url: '/api/doc/1/movements', method: 'GET' },
    },
  },
}

describe('usePagedTableRows (SCRUM-368)', () => {
  beforeEach(() => {
    fetchListPage.mockReset()
    getValue.mockReset()
  })

  it('без props.pagination — строки из state, фетча нет', () => {
    getValue.mockReturnValue([{ rowId: 'r1' }])
    const node: ViewNode = { id: 't', type: 'TABLE', binding: 'rows' }
    const { result } = renderHook(() => usePagedTableRows(node), { wrapper })

    expect(result.current.paged).toBe(false)
    expect(result.current.rows).toEqual([{ rowId: 'r1' }])
    expect(getValue).toHaveBeenCalledWith('rows')
    expect(fetchListPage).not.toHaveBeenCalled()
  })

  it('PAGED — первая страница с source.url, page/size из контракта, state не читается', async () => {
    fetchListPage.mockResolvedValue({
      data: {
        content: [{ rowId: 'a' }, { rowId: 'b' }],
        number: 0,
        last: false,
      },
    })
    const { result } = renderHook(() => usePagedTableRows(pagedNode), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.rows).toHaveLength(2)
    })
    expect(result.current.paged).toBe(true)
    expect(result.current.hasNextPage).toBe(true)
    expect(fetchListPage).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/api/doc/1/movements',
        method: 'GET',
        page: 0,
        size: 2,
      })
    )
  })

  it('fetchNextPage докладывает следующую страницу к строкам', async () => {
    fetchListPage
      .mockResolvedValueOnce({
        data: {
          content: [{ rowId: 'a' }, { rowId: 'b' }],
          number: 0,
          last: false,
        },
      })
      .mockResolvedValueOnce({
        data: { content: [{ rowId: 'c' }], number: 1, last: true },
      })
    const { result } = renderHook(() => usePagedTableRows(pagedNode), {
      wrapper,
    })
    await waitFor(() => {
      expect(result.current.rows).toHaveLength(2)
    })

    result.current.fetchNextPage()
    await waitFor(() => {
      expect(result.current.rows).toHaveLength(3)
    })
    expect(result.current.hasNextPage).toBe(false)
    expect(fetchListPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, size: 2 })
    )
  })
})
