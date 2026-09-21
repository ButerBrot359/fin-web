// SCRUM-360 v6 §8 (дерево, фаза B): поведение LIST-узла при displayMode=TREE —
// раскрыватель шлёт list.toggleExpand c behavior действия, сортировка заголовком
// подавлена, view/expanded из source.params доезжают до queryKey, двойной клик
// по группе уходит серверной командой activate (сервер сам инвертирует, §8.5).
import { render, cleanup, fireEvent, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockedFunction } from 'vitest'

vi.mock('@/shared/assets/icons/search.svg', () => ({ default: () => null }))
vi.mock('@/shared/assets/icons/folder-icon.svg', () => ({
  default: () => <span data-testid="icon-folder" />,
}))
vi.mock('@/shared/assets/icons/list-element-icon.svg', () => ({
  default: () => <span data-testid="icon-list-element" />,
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

const { dispatchMock } = vi.hoisted(() => ({ dispatchMock: vi.fn() }))
vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => dispatchMock,
}))

vi.mock('../../../lib/stores/selection-store', () => ({
  useSelectionStore: (
    selector: (s: {
      setSelection: () => void
      clearSelection: () => void
    }) => unknown
  ) => selector({ setSelection: vi.fn(), clearSelection: vi.fn() }),
}))
vi.mock('../../../api/reference-options', () => ({ fetchListPage: vi.fn() }))

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

import { ListNode } from './list-node'
import type { ViewNode } from '../../../types/view'

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

const TREE_SOURCE = {
  url: '/api/dictionaries/entries/Banki/search',
  method: 'POST',
  body: { filters: [], logic: 'AND' },
  params: { view: 'tree', expanded: '30649' },
}

const treeNode = (overrides?: Record<string, unknown>) =>
  ({
    id: 'list.Banki.list',
    type: 'LIST',
    props: {
      displayMode: 'TREE',
      source: TREE_SOURCE,
      sortState: { column: 'Naimenovaniya', dir: 'ASC' },
      ...overrides,
    },
    children: [
      {
        id: 'col-name',
        type: 'TABLE_COLUMN',
        props: {
          header: 'Наименование',
          attributeCode: 'Naimenovaniya',
          sortable: true,
          cellKind: 'HIERARCHY',
          iconMap: { true: 'folder', false: 'listElement' },
          indentPerLevel: 16,
        },
      },
    ],
    actions: [
      { trigger: 'activate', command: 'list.rowOpen:Banki' },
      { trigger: 'sort', command: 'list.applySort:Banki' },
      {
        trigger: 'expand',
        command: 'list.toggleExpand',
        behavior: { flushPendingTables: false, resetsDirty: false },
      },
    ],
  }) as unknown as ViewNode

const rows = [
  {
    id: 30649,
    Naimenovaniya: 'Поставщики',
    isGroup: true,
    _level: 0,
    _isGroup: true,
    _hasChildren: true,
    _expanded: true,
  },
  {
    id: 30712,
    Naimenovaniya: 'Поставщики Астаны',
    isGroup: true,
    _level: 1,
    _isGroup: true,
    _hasChildren: true,
    _expanded: false,
  },
]

describe('ListNode — displayMode=TREE (SCRUM-360 v6 §8)', () => {
  afterEach(() => {
    cleanup()
  })
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    useInfiniteQuery.mockReset()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    useInfiniteQuery.mockReturnValue({
      data: {
        pages: [
          { data: { content: rows, last: true, number: 0, totalElements: 2 } },
        ],
      },
      isLoading: false,
      isError: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
    })
    dispatchMock.mockReset()
    dispatchMock.mockReturnValue(undefined)
  })

  it('view=tree и expanded из source.params доезжают до queryKey (§8.7 п.6)', () => {
    render(<ListNode node={treeNode()} />)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const cfg = useInfiniteQuery.mock.calls[0][0] as { queryKey: unknown[] }
    expect(cfg.queryKey).toContainEqual({ view: 'tree', expanded: '30649' })
  })

  it('клик по раскрывателю свёрнутого узла → list.toggleExpand {id, expanded:true} с behavior действия', () => {
    const { container } = render(<ListNode node={treeNode()} />)
    const secondRow = container.querySelectorAll('tbody tr')[1]
    fireEvent.click(
      within(secondRow as HTMLElement).getByRole('button', {
        name: 'table.expandRow',
      })
    )
    expect(dispatchMock).toHaveBeenCalledWith(
      {
        type: 'COMMAND',
        command: 'list.toggleExpand',
        value: { id: 30712, expanded: true },
        sourceNodeId: 'list.Banki.list',
      },
      { flushPendingTables: false, resetsDirty: false }
    )
  })

  it('двойной клик по строке-группе диспатчит activate (сервер сам инвертирует, §8.5), а не drill-down', () => {
    const { container } = render(<ListNode node={treeNode()} />)
    const firstRow = container.querySelectorAll('tbody tr')[0]
    fireEvent.doubleClick(firstRow)
    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'COMMAND',
      command: 'list.rowOpen:Banki',
      value: { id: 30649 },
      sourceNodeId: 'list.Banki.list',
    })
  })

  it('в TREE сортировка заголовком подавлена: клик по заголовку не диспатчит applySort (§8.1)', () => {
    const { container } = render(<ListNode node={treeNode()} />)
    const header = container.querySelector('thead th')!
    // Кнопки сортировки в заголовке нет вовсе — кликаем по самому th для верности
    fireEvent.click(header)
    const sortCalls = dispatchMock.mock.calls.filter((call) => {
      const action = call[0] as { command?: string } | undefined
      return action?.command === 'list.applySort:Banki'
    })
    expect(sortCalls).toHaveLength(0)
  })

  it('без действия expand раскрыватель не рендерится (fail-closed)', () => {
    const node = treeNode()
    ;(node as { actions: { trigger: string }[] }).actions = (
      node as { actions: { trigger: string }[] }
    ).actions.filter((a) => a.trigger !== 'expand')
    const { container } = render(<ListNode node={node} />)
    const body = container.querySelector('tbody') as HTMLElement
    expect(within(body).queryAllByRole('button')).toHaveLength(0)
  })
})
