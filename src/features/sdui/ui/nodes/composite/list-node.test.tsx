import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockedFunction } from 'vitest'

vi.mock('@/shared/assets/icons/search.svg', () => ({ default: () => null }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))
vi.mock('../../../lib/dispatch', () => ({ useSduiDispatch: () => vi.fn() }))

const { setSelectionMock, clearSelectionMock } = vi.hoisted(() => ({
  setSelectionMock: vi.fn(),
  clearSelectionMock: vi.fn(),
}))
vi.mock('../../../lib/stores/ref-picker-selection-store', () => ({
  useRefPickerSelectionStore: (
    selector: (s: {
      setSelection: typeof setSelectionMock
      clearSelection: typeof clearSelectionMock
    }) => unknown
  ) =>
    selector({
      setSelection: setSelectionMock,
      clearSelection: clearSelectionMock,
    }),
}))
vi.mock('../../../api/reference-options', () => ({ fetchListPage: vi.fn() }))

// Виртуализация в jsdom без размеров контейнера не рендерит строки —
// подменяем на «показать всё», чтобы тестировать выбор строки/сброс выделения (M5).
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (cfg: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: cfg.count }, (_, index) => ({
        index,
        start: index * 40,
        end: (index + 1) * 40,
        key: index,
      })),
    getTotalSize: () => cfg.count * 40,
  }),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const useInfiniteQuery: MockedFunction<any> = vi.fn()
vi.mock('@tanstack/react-query', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  useInfiniteQuery: (cfg: Record<string, unknown>) => useInfiniteQuery(cfg),
}))

import { fetchListPage } from '../../../api/reference-options'
import { ListNode } from './list-node'
import type { ViewNode } from '../../../types/view'

// jsdom не реализует IntersectionObserver (используется для infinite-scroll в list-node).
class IntersectionObserverStub {
  observe(): void {
    void 0
  }
  unobserve(): void {
    void 0
  }
  disconnect(): void {
    void 0
  }
}
;(
  globalThis as unknown as {
    IntersectionObserver: typeof IntersectionObserverStub
  }
).IntersectionObserver = IntersectionObserverStub

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
    setSelectionMock.mockReset()
    clearSelectionMock.mockReset()
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

describe('ListNode — M5: сброс выделения при смене source', () => {
  afterEach(() => {
    cleanup()
  })

  const selectableNode = {
    id: 'lst',
    type: 'LIST',
    props: {
      source: { url: '/x/search', method: 'POST', body: { filters: [] } },
    },
    children: [],
    actions: [{ trigger: 'select', selectionField: 'listSelect' }],
  } as unknown as ViewNode

  const pageWithRow = (id: number) => ({
    data: {
      content: [{ id, name: `Row ${String(id)}` }],
      last: true,
      number: 0,
      totalElements: 1,
    },
  })

  // 'hover:bg-ui-07' всегда содержит подстроку 'bg-ui-07' — проверяем точный класс,
  // а не подстроку.
  const isRowSelected = (container: HTMLElement): boolean =>
    (container.querySelector('tbody tr')?.className.split(' ') ?? []).includes(
      'bg-ui-07'
    )

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    useInfiniteQuery.mockReset()
    vi.mocked(fetchListPage).mockReset()
    vi.mocked(fetchListPage).mockResolvedValue(pageWithRow(1))
    setSelectionMock.mockReset()
    clearSelectionMock.mockReset()
  })

  it('клик по строке выделяет её и публикует id в selection-стор', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    useInfiniteQuery.mockReturnValue({
      ...baseQueryResult,
      isLoading: false,
      data: { pages: [pageWithRow(1)] },
    })

    const { container } = render(<ListNode node={selectableNode} />)
    const row = container.querySelector('tbody tr')
    expect(row).toBeTruthy()

    fireEvent.click(row!)

    expect(isRowSelected(container)).toBe(true)
    expect(setSelectionMock).toHaveBeenLastCalledWith('listSelect', 1)
  })

  it('смена идентичности source сбрасывает выделенную строку и публикацию null в сторе', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    useInfiniteQuery.mockReturnValue({
      ...baseQueryResult,
      isLoading: false,
      data: { pages: [pageWithRow(1)] },
    })

    const { container, rerender } = render(<ListNode node={selectableNode} />)
    const row = container.querySelector('tbody tr')
    fireEvent.click(row!)
    expect(isRowSelected(container)).toBe(true)

    setSelectionMock.mockClear()
    clearSelectionMock.mockClear()

    // Сервер прислал setProp-патч на source (ответ на sort/filter/period) —
    // тот же список строк, но новая идентичность source.
    const newSourceNode = {
      ...selectableNode,
      props: {
        source: {
          url: '/x/search',
          method: 'POST',
          body: { filters: [{ field: 'x' }] },
        },
      },
    } as unknown as ViewNode

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    useInfiniteQuery.mockReturnValue({
      ...baseQueryResult,
      isLoading: false,
      data: { pages: [pageWithRow(1)] },
    })

    rerender(<ListNode node={newSourceNode} />)

    expect(isRowSelected(container)).toBe(false)
    expect(setSelectionMock).toHaveBeenCalledWith('listSelect', null)
  })

  it('смена содержимого source (без смены идентичности) НЕ сбрасывает выделение', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    useInfiniteQuery.mockReturnValue({
      ...baseQueryResult,
      isLoading: false,
      data: { pages: [pageWithRow(1)] },
    })

    const { container, rerender } = render(<ListNode node={selectableNode} />)
    const row = container.querySelector('tbody tr')
    fireEvent.click(row!)
    expect(isRowSelected(container)).toBe(true)

    setSelectionMock.mockClear()

    // Ререндер с эквивалентным по идентичности source (тот же JSON) — например,
    // родитель перерендерился без ответа сервера. Выделение сохраняется.
    rerender(<ListNode node={{ ...selectableNode }} />)

    expect(isRowSelected(container)).toBe(true)
    expect(setSelectionMock).not.toHaveBeenCalledWith('listSelect', null)
  })
})
