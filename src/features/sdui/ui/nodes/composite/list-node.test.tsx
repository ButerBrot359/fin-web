import {
  render,
  cleanup,
  screen,
  fireEvent,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockedFunction } from 'vitest'

vi.mock('@/shared/assets/icons/search.svg', () => ({ default: () => null }))
vi.mock('@/shared/assets/icons/layers.svg', () => ({ default: () => null }))
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

const { setSelectionMock, clearSelectionMock } = vi.hoisted(() => ({
  setSelectionMock: vi.fn(),
  clearSelectionMock: vi.fn(),
}))
vi.mock('../../../lib/stores/selection-store', () => ({
  useSelectionStore: (
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

// DateTimeInput — MUI-пикер, в jsdom без LocalizationProvider не рендерится
// осмысленно. Предмет теста 2d — не рендер календаря, а КАКОЕ value уходит в
// dispatch, поэтому подменяем на плоский input (см. прецедент date-cell-editor.test.tsx).
vi.mock('@/shared/ui/inputs', () => ({
  DateTimeInput: (props: {
    value?: string
    onChange: (v: string) => void
    label?: string
  }) => (
    <input
      data-testid={`date-input-${props.label ?? ''}`}
      defaultValue={props.value}
      onChange={(e) => {
        props.onChange(e.target.value)
      }}
    />
  ),
  // SCRUM-291 2c-a: воронка колоночного фильтра (list-filter-value-control.tsx)
  // тоже завязана на @/shared/ui/inputs — здесь тестируется только маршрутизация
  // list-node → funnel → dispatch, а не рендер конкретных MUI-контролов
  // (это покрыто list-filter-value-control.test.tsx), поэтому плоские заглушки.
  TextInput: (props: {
    value?: string
    onChange: (e: { target: { value: string } }) => void
  }) => (
    <input
      data-testid="scalar-text"
      value={props.value ?? ''}
      onChange={(e) => {
        props.onChange(e)
      }}
    />
  ),
  NumberInput: (props: {
    value?: string
    onChange: (e: { target: { value: string } }) => void
  }) => (
    <input
      data-testid="scalar-number"
      value={props.value ?? ''}
      onChange={(e) => {
        props.onChange(e)
      }}
    />
  ),
  AutocompleteInput: (props: {
    value: { id: number | string } | null
    options: { id: number | string; label: string }[]
    onChange: (v: { id: number | string; label: string } | null) => void
  }) => (
    <select
      data-testid="ref-select"
      value={props.value?.id ?? ''}
      onChange={(e) => {
        const opt =
          props.options.find((o) => String(o.id) === e.target.value) ?? null
        props.onChange(opt)
      }}
    >
      <option value="" />
      {props.options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}))

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
    dispatchMock.mockReset()
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
    dispatchMock.mockReset()
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

describe('ListNode — 2b: сортировка кликом по заголовку', () => {
  afterEach(() => {
    cleanup()
  })

  // SCRUM-362 B-1: команда сортировки приходит готовой в sort-действии узла,
  // фронт её не собирает из TypeCode.
  const sortableNode = (sortState?: { column: string; dir: 'ASC' | 'DESC' }) =>
    ({
      id: 'lst',
      type: 'LIST',
      props: {
        source: { url: '/x/search', method: 'POST' },
        ...(sortState ? { sortState } : {}),
      },
      children: [
        {
          id: 'col-data',
          type: 'TABLE_COLUMN',
          props: { header: 'Дата', attributeCode: 'Data', sortable: true },
        },
        {
          id: 'col-nomer',
          type: 'TABLE_COLUMN',
          props: { header: 'Номер', attributeCode: 'Nomer', sortable: false },
        },
      ],
      actions: [
        { trigger: 'activate', command: 'list.rowOpen:TypeX' },
        { trigger: 'sort', command: 'list.applySort:TypeX' },
      ],
    }) as unknown as ViewNode

  const pageWithRow = (id: number) => ({
    data: {
      content: [{ id, Data: '2026-01-01', Nomer: '1' }],
      last: true,
      number: 0,
      totalElements: 1,
    },
  })

  const headerCells = (container: HTMLElement) =>
    container.querySelectorAll<HTMLElement>('thead th')

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    useInfiniteQuery.mockReset()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    useInfiniteQuery.mockReturnValue({
      ...baseQueryResult,
      isLoading: false,
      data: { pages: [pageWithRow(1)] },
    })
    vi.mocked(fetchListPage).mockReset()
    vi.mocked(fetchListPage).mockResolvedValue(pageWithRow(1))
    setSelectionMock.mockReset()
    clearSelectionMock.mockReset()
    dispatchMock.mockReset()
    dispatchMock.mockReturnValue(undefined)
  })

  it('клик по сортируемому заголовку без активной сортировки → applySort ASC', () => {
    const { container } = render(<ListNode node={sortableNode()} />)
    const dataHeader = headerCells(container)[0]
    fireEvent.click(within(dataHeader).getByRole('button'))

    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'COMMAND',
      command: 'list.applySort:TypeX',
      value: { column: 'Data', dir: 'ASC' },
      sourceNodeId: 'lst',
    })
  })

  it('клик по уже отсортированной колонке переключает направление ASC → DESC', () => {
    const { container } = render(
      <ListNode node={sortableNode({ column: 'Data', dir: 'ASC' })} />
    )
    const dataHeader = headerCells(container)[0]
    fireEvent.click(within(dataHeader).getByRole('button'))

    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'COMMAND',
      command: 'list.applySort:TypeX',
      value: { column: 'Data', dir: 'DESC' },
      sourceNodeId: 'lst',
    })
  })

  it('клик по несортируемому заголовку ничего не диспатчит', () => {
    const { container } = render(<ListNode node={sortableNode()} />)
    const nomerHeader = headerCells(container)[1]
    fireEvent.click(within(nomerHeader).getByText('Номер'))

    expect(dispatchMock).not.toHaveBeenCalled()
  })

  it('B-1: без sort-действия сортировка выключена даже у sortable-колонок', () => {
    const node = {
      ...sortableNode(),
      actions: [{ trigger: 'activate', command: 'list.rowOpen:TypeX' }],
    } as unknown as ViewNode
    const { container } = render(<ListNode node={node} />)
    const dataHeader = headerCells(container)[0]
    expect(within(dataHeader).queryByRole('button')).toBeNull()
    fireEvent.click(within(dataHeader).getByText('Дата'))
    expect(dispatchMock).not.toHaveBeenCalled()
  })

  it('стрелка рисуется только на колонке из sortState; без sortState — стрелки нет нигде', () => {
    const { container, rerender } = render(
      <ListNode node={sortableNode({ column: 'Data', dir: 'ASC' })} />
    )
    const [dataHeader, nomerHeader] = headerCells(container)
    expect(dataHeader.textContent).toContain('▲')
    expect(nomerHeader.textContent).not.toMatch(/[▲▼]/)

    rerender(<ListNode node={sortableNode()} />)
    const headersAfter = headerCells(container)
    expect(headersAfter[0].textContent).not.toMatch(/[▲▼]/)
    expect(headersAfter[1].textContent).not.toMatch(/[▲▼]/)
  })

  it('подавляет повторные клики, пока предыдущий applySort не завершился', () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function -- намеренно never-resolving промис, эмулирует in-flight запрос
    dispatchMock.mockReturnValue(new Promise(() => {}))
    const { container } = render(<ListNode node={sortableNode()} />)
    const dataHeader = headerCells(container)[0]
    const button = within(dataHeader).getByRole('button')

    fireEvent.click(button)
    fireEvent.click(button)

    expect(dispatchMock).toHaveBeenCalledTimes(1)
  })
})

describe('ListNode — 2d: период (from/to)', () => {
  afterEach(() => {
    cleanup()
  })

  // SCRUM-362 B-1: команда периода приходит готовой в period-действии узла;
  // контрол рендерится по наличию действия.
  const periodNode = (period?: { from: string | null; to: string | null }) =>
    ({
      id: 'lst',
      type: 'LIST',
      props: {
        source: { url: '/x/search', method: 'POST' },
        ...(period ? { period } : {}),
      },
      children: [],
      actions: [
        { trigger: 'activate', command: 'list.rowOpen:TypeX' },
        { trigger: 'period', command: 'list.applyPeriod:TypeX' },
      ],
    }) as unknown as ViewNode

  const pageWithRow = (id: number) => ({
    data: {
      content: [{ id, Data: '2026-01-01' }],
      last: true,
      number: 0,
      totalElements: 1,
    },
  })

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    useInfiniteQuery.mockReset()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    useInfiniteQuery.mockReturnValue({
      ...baseQueryResult,
      isLoading: false,
      data: { pages: [pageWithRow(1)] },
    })
    vi.mocked(fetchListPage).mockReset()
    vi.mocked(fetchListPage).mockResolvedValue(pageWithRow(1))
    setSelectionMock.mockReset()
    clearSelectionMock.mockReset()
    dispatchMock.mockReset()
  })

  it('period-действие есть → рендерятся два инпута даты', () => {
    render(<ListNode node={periodNode({ from: null, to: null })} />)
    expect(screen.getByTestId('date-input-table.periodFrom')).toBeTruthy()
    expect(screen.getByTestId('date-input-table.periodTo')).toBeTruthy()
  })

  it('изменение "from" → applyPeriod с текущей парой (новый from + существующий to)', () => {
    render(<ListNode node={periodNode({ from: null, to: '2026-01-31' })} />)
    const fromInput = screen.getByTestId('date-input-table.periodFrom')
    fireEvent.change(fromInput, { target: { value: '2026-01-01' } })

    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'COMMAND',
      command: 'list.applyPeriod:TypeX',
      value: { from: '2026-01-01', to: '2026-01-31' },
      sourceNodeId: 'lst',
    })
  })

  it('изменение "to" → applyPeriod с текущей парой (существующий from + новый to)', () => {
    render(<ListNode node={periodNode({ from: '2026-01-01', to: null })} />)
    const toInput = screen.getByTestId('date-input-table.periodTo')
    fireEvent.change(toInput, { target: { value: '2026-01-31' } })

    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'COMMAND',
      command: 'list.applyPeriod:TypeX',
      value: { from: '2026-01-01', to: '2026-01-31' },
      sourceNodeId: 'lst',
    })
  })

  it('очистка обеих границ шлёт {from:null,to:null} (без отдельной команды clear)', () => {
    render(<ListNode node={periodNode({ from: '2026-01-01', to: null })} />)
    const fromInput = screen.getByTestId('date-input-table.periodFrom')
    fireEvent.change(fromInput, { target: { value: '' } })

    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'COMMAND',
      command: 'list.applyPeriod:TypeX',
      value: { from: null, to: null },
      sourceNodeId: 'lst',
    })
  })

  it('B-1: без period-действия контрол периода не рендерится, даже при props.period', () => {
    const node = {
      id: 'lst',
      type: 'LIST',
      props: {
        source: { url: '/x/search', method: 'POST' },
        period: { from: null, to: null },
      },
      children: [],
      actions: [{ trigger: 'activate', command: 'list.rowOpen:TypeX' }],
    } as unknown as ViewNode
    render(<ListNode node={node} />)
    expect(screen.queryByTestId('date-input-table.periodFrom')).toBeNull()
    expect(screen.queryByTestId('date-input-table.periodTo')).toBeNull()
  })
})

describe('ListNode — 2c-a: воронка колоночного фильтра', () => {
  afterEach(() => {
    cleanup()
  })

  // SCRUM-362 B-1: команда фильтра приходит готовой в filter-действии узла;
  // воронка рендерится по наличию действия.
  const filterableNode = () =>
    ({
      id: 'lst',
      type: 'LIST',
      props: {
        source: { url: '/x/search', method: 'POST' },
        filterOpLabels: { eq: 'Равно', ne: 'Не равно' },
      },
      children: [
        {
          id: 'col-nomer',
          type: 'TABLE_COLUMN',
          // Алиас «Номер»: attributeCode="Nomer", но filterField="code" — команда
          // ДОЛЖНА уйти с "code", не с "Nomer" (design §2c/§7).
          props: {
            header: 'Номер',
            attributeCode: 'Nomer',
            filterField: 'code',
            filterOps: ['eq', 'ne'],
            dataType: 'STRING',
          },
        },
        {
          id: 'col-status',
          type: 'TABLE_COLUMN',
          props: {
            header: 'Статус',
            attributeCode: 'Status',
            filterField: 'Status',
            filterOps: ['eq'],
            filterValueOptions: [
              { value: 'A', label: 'Активен', id: 1, code: 'A' },
              { value: 'B', label: 'Завершён', id: 2, code: 'B' },
            ],
          },
        },
        {
          id: 'col-data',
          type: 'TABLE_COLUMN',
          props: { header: 'Дата', attributeCode: 'Data' },
        },
      ],
      actions: [
        { trigger: 'activate', command: 'list.rowOpen:TypeX' },
        { trigger: 'filter', command: 'list.applyFilter:TypeX' },
      ],
    }) as unknown as ViewNode

  const pageWithRow = (id: number) => ({
    data: {
      content: [{ id, Nomer: '1', Status: 'A', Data: '2026-01-01' }],
      last: true,
      number: 0,
      totalElements: 1,
    },
  })

  const headerCells = (container: HTMLElement) =>
    container.querySelectorAll<HTMLElement>('thead th')

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    useInfiniteQuery.mockReset()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    useInfiniteQuery.mockReturnValue({
      ...baseQueryResult,
      isLoading: false,
      data: { pages: [pageWithRow(1)] },
    })
    vi.mocked(fetchListPage).mockReset()
    vi.mocked(fetchListPage).mockResolvedValue(pageWithRow(1))
    setSelectionMock.mockReset()
    clearSelectionMock.mockReset()
    dispatchMock.mockReset()
    dispatchMock.mockReturnValue(undefined)
  })

  it('воронка рисуется только на колонках с непустым filterOps', () => {
    const { container } = render(<ListNode node={filterableNode()} />)
    const [nomerHeader, statusHeader, dataHeader] = headerCells(container)

    expect(
      within(nomerHeader).getByRole('button', { name: 'table.filter' })
    ).toBeTruthy()
    expect(
      within(statusHeader).getByRole('button', { name: 'table.filter' })
    ).toBeTruthy()
    expect(
      within(dataHeader).queryByRole('button', { name: 'table.filter' })
    ).toBeNull()
  })

  it('лейблы операторов — из LIST.props.filterOpLabels', () => {
    const { container } = render(<ListNode node={filterableNode()} />)
    const nomerHeader = headerCells(container)[0]
    fireEvent.click(
      within(nomerHeader).getByRole('button', { name: 'table.filter' })
    )
    const opSelect = screen.getByTestId('filter-op-select')
    expect(opSelect.textContent).toContain('Равно')
    expect(opSelect.textContent).toContain('Не равно')
  })

  it('Применить (ENUMS) → dispatch list.applyFilter с filterField (не attributeCode) и строковым value', () => {
    const { container } = render(<ListNode node={filterableNode()} />)
    const statusHeader = headerCells(container)[1]
    fireEvent.click(
      within(statusHeader).getByRole('button', { name: 'table.filter' })
    )
    fireEvent.change(screen.getByTestId('filter-enum-select'), {
      target: { value: 'B' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'table.filterApply' }))

    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'COMMAND',
      command: 'list.applyFilter:TypeX',
      value: { field: 'Status', op: 'eq', value: 'B' },
      sourceNodeId: 'lst',
    })
  })

  it('value-требующий оператор без значения → Применить неактивна, list.applyFilter не уходит', () => {
    const { container } = render(<ListNode node={filterableNode()} />)
    const nomerHeader = headerCells(container)[0]
    fireEvent.click(
      within(nomerHeader).getByRole('button', { name: 'table.filter' })
    )
    const applyBtn = screen.getByRole('button', { name: 'table.filterApply' })
    fireEvent.click(applyBtn)

    expect(dispatchMock).not.toHaveBeenCalled()

    fireEvent.change(screen.getByTestId('scalar-text'), {
      target: { value: 'РОМ' },
    })
    fireEvent.click(applyBtn)

    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'COMMAND',
      command: 'list.applyFilter:TypeX',
      value: { field: 'code', op: 'eq', value: 'РОМ' },
      sourceNodeId: 'lst',
    })
  })

  it('B-1: без filter-действия воронка не рендерится (fail-closed)', () => {
    const node = {
      ...filterableNode(),
      actions: [{ trigger: 'activate', command: 'list.rowOpen:TypeX' }],
    } as unknown as ViewNode
    const { container } = render(<ListNode node={node} />)
    expect(container.querySelector('[aria-label="table.filter"]')).toBeNull()
  })
})

describe('ListNode — 2c-b: панель чипов', () => {
  afterEach(() => {
    cleanup()
  })

  // SCRUM-362 B-1: команды снятия фильтров приходят готовыми в clearFilter/
  // clearAllFilters-действиях узла; панель чипов рендерится по их наличию.
  const nodeWithChips = (
    chips: { field: string; label: string }[] | undefined,
    { withClearActions = true }: { withClearActions?: boolean } = {}
  ) =>
    ({
      id: 'lst',
      type: 'LIST',
      props: {
        source: { url: '/x/search', method: 'POST' },
        ...(chips === undefined ? {} : { filterChips: chips }),
      },
      children: [],
      actions: withClearActions
        ? [
            { trigger: 'activate', command: 'list.rowOpen:TypeX' },
            { trigger: 'clearFilter', command: 'list.clearFilter:TypeX' },
            {
              trigger: 'clearAllFilters',
              command: 'list.clearAllFilters:TypeX',
            },
          ]
        : [{ trigger: 'activate', command: 'list.rowOpen:TypeX' }],
    }) as unknown as ViewNode

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    useInfiniteQuery.mockReset()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    useInfiniteQuery.mockReturnValue({
      ...baseQueryResult,
      isLoading: false,
      data: { pages: [{ data: { content: [], last: true, number: 0 } }] },
    })
    vi.mocked(fetchListPage).mockReset()
    setSelectionMock.mockReset()
    clearSelectionMock.mockReset()
    dispatchMock.mockReset()
    dispatchMock.mockReturnValue(undefined)
  })

  it('рендерит чипы из props.filterChips с label дословно с сервера', () => {
    render(
      <ListNode
        node={nodeWithChips([
          { field: 'Kontragent', label: 'Контрагент равно: ТОО «Ромашка»' },
        ])}
      />
    )
    expect(screen.getByText('Контрагент равно: ТОО «Ромашка»')).toBeTruthy()
  })

  it('крестик чипа → dispatch list.clearFilter:{TypeCode} value={field}', () => {
    render(
      <ListNode
        node={nodeWithChips([
          { field: 'Kontragent', label: 'Контрагент равно: X' },
        ])}
      />
    )
    fireEvent.click(screen.getByLabelText('table.filterRemoveChip'))

    expect(dispatchMock).toHaveBeenCalledWith({
      type: 'COMMAND',
      command: 'list.clearFilter:TypeX',
      value: { field: 'Kontragent' },
      sourceNodeId: 'lst',
    })
  })

  it('«Сбросить все» → dispatch list.clearAllFilters:{TypeCode} БЕЗ value', () => {
    render(
      <ListNode
        node={nodeWithChips([
          { field: 'Kontragent', label: 'Контрагент равно: X' },
          { field: 'Status', label: 'Статус равно: Активен' },
        ])}
      />
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'table.filterClearAll' })
    )

    const call = dispatchMock.mock.calls.find(
      (args: unknown[]) =>
        (args[0] as { command?: string }).command ===
        'list.clearAllFilters:TypeX'
    )
    expect(call).toBeTruthy()
    expect(call?.[0]).toEqual({
      type: 'COMMAND',
      command: 'list.clearAllFilters:TypeX',
      sourceNodeId: 'lst',
    })
    expect(call?.[0]).not.toHaveProperty('value')
  })

  it('filterChips отсутствует/пуст → панель чипов и «Сбросить все» не рендерятся', () => {
    const { rerender } = render(<ListNode node={nodeWithChips(undefined)} />)
    expect(screen.queryByLabelText('table.filterRemoveChip')).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'table.filterClearAll' })
    ).toBeNull()

    rerender(<ListNode node={nodeWithChips([])} />)
    expect(screen.queryByLabelText('table.filterRemoveChip')).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'table.filterClearAll' })
    ).toBeNull()
  })

  it('B-1: без clearFilter/clearAllFilters-действий панель чипов не рендерится (fail-closed)', () => {
    render(
      <ListNode
        node={nodeWithChips(
          [{ field: 'Kontragent', label: 'Контрагент равно: X' }],
          { withClearActions: false }
        )}
      />
    )
    expect(screen.queryByLabelText('table.filterRemoveChip')).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'table.filterClearAll' })
    ).toBeNull()
  })
})

describe('ListNode — 3b: cellKind="ICON" (§17.2)', () => {
  afterEach(() => {
    cleanup()
  })

  const iconNode = () =>
    ({
      id: 'lst',
      type: 'LIST',
      props: {
        source: { url: '/x/search', method: 'POST' },
      },
      children: [
        {
          id: 'col-isGroup',
          type: 'TABLE_COLUMN',
          props: {
            attributeCode: 'isGroup',
            header: '',
            width: 40,
            cellKind: 'ICON',
            iconMap: { true: 'folder', false: 'listElement' },
          },
        },
        {
          id: 'col-code',
          type: 'TABLE_COLUMN',
          props: { header: 'Код', attributeCode: 'code' },
        },
      ],
      actions: [],
    }) as unknown as ViewNode

  const pageWithRows = (
    rows: { id: number; isGroup: boolean; code: string }[]
  ) => ({
    data: { content: rows, last: true, number: 0, totalElements: rows.length },
  })

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    useInfiniteQuery.mockReset()
    vi.mocked(fetchListPage).mockReset()
    vi.mocked(fetchListPage).mockResolvedValue(pageWithRows([]))
    setSelectionMock.mockReset()
    clearSelectionMock.mockReset()
    dispatchMock.mockReset()
  })

  it('isGroup=true → рендерит иконку folder, isGroup=false → listElement, без литерального "true"/"false"', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    useInfiniteQuery.mockReturnValue({
      ...baseQueryResult,
      isLoading: false,
      data: {
        pages: [
          pageWithRows([
            { id: 1, isGroup: true, code: 'GRP' },
            { id: 2, isGroup: false, code: 'ELM' },
          ]),
        ],
      },
    })

    const { container } = render(<ListNode node={iconNode()} />)
    const rows = container.querySelectorAll('tbody tr')
    expect(rows.length).toBe(2)

    const groupRowIconCell = within(rows[0] as HTMLElement).getAllByRole(
      'cell'
    )[0]
    expect(within(groupRowIconCell).getByTestId('icon-folder')).toBeTruthy()
    expect(groupRowIconCell.textContent).not.toContain('true')

    const elementRowIconCell = within(rows[1] as HTMLElement).getAllByRole(
      'cell'
    )[0]
    expect(
      within(elementRowIconCell).getByTestId('icon-list-element')
    ).toBeTruthy()
    expect(elementRowIconCell.textContent).not.toContain('false')
  })

  it('неизвестное/отсутствующее имя иконки в iconMap → пустая ячейка, без исключения и без текста', () => {
    const nodeWithBadMap = {
      ...iconNode(),
      children: [
        {
          id: 'col-isGroup',
          type: 'TABLE_COLUMN',
          props: {
            attributeCode: 'isGroup',
            header: '',
            cellKind: 'ICON',
            iconMap: { true: 'unknownGlyph' },
          },
        },
      ],
    } as unknown as ViewNode

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    useInfiniteQuery.mockReturnValue({
      ...baseQueryResult,
      isLoading: false,
      data: { pages: [pageWithRows([{ id: 1, isGroup: true, code: 'GRP' }])] },
    })

    expect(() => {
      render(<ListNode node={nodeWithBadMap} />)
    }).not.toThrow()

    const cell = document.querySelector('tbody tr td')!
    expect(cell.textContent).toBe('')
  })

  it('обычная (не-ICON) колонка по-прежнему рендерит текстовое значение', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    useInfiniteQuery.mockReturnValue({
      ...baseQueryResult,
      isLoading: false,
      data: {
        pages: [pageWithRows([{ id: 1, isGroup: false, code: 'ELM-1' }])],
      },
    })

    render(<ListNode node={iconNode()} />)
    expect(screen.getByText('ELM-1')).toBeTruthy()
  })
})

describe('ListNode — навигация по уровням иерархического справочника', () => {
  afterEach(() => {
    cleanup()
  })
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    useInfiniteQuery.mockReset()
    vi.mocked(fetchListPage).mockReset()
    vi.mocked(fetchListPage).mockResolvedValue({
      data: { content: [], last: true, number: 0 },
    })
    dispatchMock.mockReset()
    setSelectionMock.mockReset()
  })

  const DICT_URL =
    '/api/universaldomain-entries/DICTIONARY/Klassifikatsiya/paged'

  const dictNode = (url = DICT_URL, params?: Record<string, string>) =>
    ({
      id: 'lst',
      type: 'LIST',
      props: { source: { url, ...(params && { params }) }, searchable: true },
      children: [
        {
          id: 'col-name',
          type: 'TABLE_COLUMN',
          props: { header: 'Наименование', attributeCode: 'nameRu' },
        },
      ],
      actions: [{ trigger: 'select', command: 'ref.select:field' }],
    }) as unknown as ViewNode

  const withRows = (rows: Record<string, unknown>[]) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    useInfiniteQuery.mockReturnValue({
      ...baseQueryResult,
      isLoading: false,
      data: {
        pages: [
          {
            data: {
              content: rows,
              last: true,
              number: 0,
              totalElements: rows.length,
            },
          },
        ],
      },
    })
  }

  /** Параметры, с которыми ушёл последний вызов useInfiniteQuery. */
  const lastQueryParams = () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const calls = useInfiniteQuery.mock.calls as { queryKey: unknown[] }[][]
    return calls.at(-1)?.[0]?.queryKey[2] as Record<string, string>
  }

  it('props.selectedPath → панель открывается внутри папки записи, а не на корне', () => {
    withRows([{ id: 42, nameRu: '1 уровень' }])
    const node = dictNode()
    Object.assign(node.props!, {
      selectedId: 42,
      selectedPath: [{ id: 78, presentation: 'Категории по уровням' }],
    })

    render(<ListNode node={node} />)

    // Уровень запрошен сразу по папке, крошка с её именем видна.
    expect(lastQueryParams()).toEqual({ parent: '78' })
    expect(screen.getByText('Категории по уровням')).toBeTruthy()
  })

  it('props.selectedId с сервера → панель открывается выделенной на этой записи', () => {
    withRows([{ id: 42, nameRu: 'Запасные части' }])
    const node = dictNode()
    // Сервер кладёт текущее значение поля в props LIST-узла панели.
    node.props!.selectedId = 42
    ;(
      node.actions as { trigger: string; selectionField?: string }[]
    )[0].selectionField = 'field.nomenklatura'

    render(<ListNode node={node} />)

    expect(setSelectionMock).toHaveBeenLastCalledWith('field.nomenklatura', 42)
  })

  it('без props.selectedId выделения нет', () => {
    withRows([{ id: 42, nameRu: 'Запасные части' }])
    const node = dictNode()
    ;(
      node.actions as { trigger: string; selectionField?: string }[]
    )[0].selectionField = 'field.nomenklatura'

    render(<ListNode node={node} />)

    expect(setSelectionMock).toHaveBeenLastCalledWith(
      'field.nomenklatura',
      null
    )
  })

  it('flatWithGroups не уходит в запрос — иначе вместо уровня придёт весь справочник', () => {
    withRows([])
    render(
      <ListNode
        node={dictNode(DICT_URL, { flatWithGroups: 'true', af: 'X:1' })}
      />
    )

    expect(lastQueryParams()).toEqual({ af: 'X:1' })
  })

  it('клик по папке грузит её содержимое запросом с parent и показывает крошки', () => {
    withRows([{ id: 28485, nameRu: 'Блок B', isGroup: true }])
    render(<ListNode node={dictNode()} />)

    fireEvent.click(screen.getByText('Блок B'))

    expect(lastQueryParams()).toEqual({ parent: '28485' })
    // Крошки: корень + текущая папка.
    expect(screen.getByText('table.treeRoot')).toBeTruthy()
  })

  it('возврат по крошке «корень» убирает parent', () => {
    withRows([{ id: 28485, nameRu: 'Блок B', isGroup: true }])
    render(<ListNode node={dictNode()} />)

    fireEvent.click(screen.getByText('Блок B'))
    expect(lastQueryParams()).toEqual({ parent: '28485' })

    fireEvent.click(screen.getByText('table.treeRoot'))
    expect(lastQueryParams()).toEqual({})
  })

  it('поиск уплощает уровни: parent не шлётся (бэк отвечает 400)', () => {
    withRows([{ id: 28485, nameRu: 'Блок B', isGroup: true }])
    render(<ListNode node={dictNode()} />)

    fireEvent.click(screen.getByText('Блок B'))
    expect(lastQueryParams()).toEqual({ parent: '28485' })

    fireEvent.change(screen.getByPlaceholderText('pageToolbar.search'), {
      target: { value: 'Здрав' },
    })

    expect(lastQueryParams()).toEqual({})
  })

  it('элемент (не папка) по-прежнему выбирается, а не проваливается', () => {
    withRows([{ id: 70, nameRu: '1-й разряд', isGroup: false }])
    render(<ListNode node={dictNode()} />)

    fireEvent.doubleClick(screen.getByText('1-й разряд'))

    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'ref.select:field',
        value: { id: 70 },
      })
    )
  })

  it('источник вне DICTIONARY: parent не поддержан, строка с isGroup выбирается', () => {
    withRows([{ id: 5, nameRu: 'Группа счетов', isGroup: true }])
    render(
      <ListNode
        node={dictNode(
          '/api/universaldomain-entries/ACCOUNT_PLAN/Hozraschet/paged'
        )}
      />
    )

    fireEvent.doubleClick(screen.getByText('Группа счетов'))

    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ value: { id: 5 } })
    )
  })

  it('панель выбора папки (groupsOnly): папка выбирается, внутрь не проваливаемся', () => {
    withRows([{ id: 28485, nameRu: 'Блок B', isGroup: true }])
    render(<ListNode node={dictNode(DICT_URL, { groupsOnly: 'true' })} />)

    fireEvent.doubleClick(screen.getByText('Блок B'))

    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ value: { id: 28485 } })
    )
  })
})
