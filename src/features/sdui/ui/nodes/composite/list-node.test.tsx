import { render, cleanup, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockedFunction } from 'vitest'

vi.mock('@/shared/assets/icons/search.svg', () => ({ default: () => null }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))
vi.mock('../../../lib/dispatch', () => ({ useSduiDispatch: () => vi.fn() }))
vi.mock('../../../lib/stores/ref-picker-selection-store', () => ({
  useRefPickerSelectionStore: () => vi.fn(),
}))
vi.mock('../../../api/reference-options', () => ({ fetchListPage: vi.fn() }))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const useInfiniteQuery: MockedFunction<any> = vi.fn()
vi.mock('@tanstack/react-query', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  useInfiniteQuery: (cfg: Record<string, unknown>) => useInfiniteQuery(cfg),
}))

import { fetchListPage } from '../../../api/reference-options'
import { ListNode } from './list-node'
import type { ViewNode } from '../../../types/view'

const baseQueryResult = {
  data: undefined,
  isLoading: true,
  isError: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: vi.fn(),
}

const searchNode = {
  id: 'lst',
  type: 'LIST',
  props: {
    source: {
      url: '/x/search',
      method: 'POST',
      params: { sortAttr: 'Data' },
      body: { filters: [], logic: 'AND' },
    },
  },
  children: [],
  actions: [],
} as unknown as ViewNode

describe('ListNode — транспорт', () => {
  afterEach(() => {
    cleanup()
  })
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    useInfiniteQuery.mockReset()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    useInfiniteQuery.mockReturnValue(baseQueryResult)
    vi.mocked(fetchListPage).mockReset()
    vi.mocked(fetchListPage).mockResolvedValue({
      data: { content: [], last: true, number: 0 },
    })
  })

  it('queryKey содержит method и body из source', () => {
    render(<ListNode node={searchNode} />)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const cfg = useInfiniteQuery.mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined
    expect(cfg?.queryKey).toEqual([
      'sdui-list',
      '/x/search',
      { sortAttr: 'Data' },
      'POST',
      { filters: [], logic: 'AND' },
      '',
    ])
  })

  it('queryFn пробрасывает method и body в fetchListPage', async () => {
    render(<ListNode node={searchNode} />)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const cfg = useInfiniteQuery.mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined
    const queryFn = cfg?.queryFn as
      | ((args: Record<string, unknown>) => Promise<unknown>)
      | undefined
    await queryFn?.({ pageParam: 0, signal: undefined })
    expect(fetchListPage).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/x/search',
        method: 'POST',
        body: { filters: [], logic: 'AND' },
      })
    )
  })

  it('isError → показывает table.loadError, а не «нет данных»', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    useInfiniteQuery.mockReturnValue({
      ...baseQueryResult,
      isLoading: false,
      isError: true,
    })
    render(<ListNode node={searchNode} />)
    expect(screen.getByText('table.loadError')).toBeTruthy()
    expect(screen.queryByText('dictSidebar.noData')).toBeNull()
  })
})
