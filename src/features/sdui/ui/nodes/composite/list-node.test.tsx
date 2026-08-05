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

  // TypeCode для list.applySort:{TypeCode} берётся из command активации строки
  // (list.rowOpen:{TypeCode}) — суффикс ПОСЛЕ ПЕРВОГО двоеточия.
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
      actions: [{ trigger: 'activate', command: 'list.rowOpen:TypeX' }],
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
    container.querySelectorAll('thead th')

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

  // TypeCode — тот же источник, что в 2b: суффикс после первого двоеточия в
  // команде активации (list.rowOpen:{TypeCode}).
  const periodNode = (period?: { from: string | null; to: string | null }) =>
    ({
      id: 'lst',
      type: 'LIST',
      props: {
        source: { url: '/x/search', method: 'POST' },
        ...(period ? { period } : {}),
      },
      children: [],
      actions: [{ trigger: 'activate', command: 'list.rowOpen:TypeX' }],
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

  it('props.period присутствует → рендерятся два инпута даты', () => {
    render(<ListNode node={periodNode({ from: null, to: null })} />)
    expect(screen.getByTestId('date-input-table.periodFrom')).toBeTruthy()
    expect(screen.getByTestId('date-input-table.periodTo')).toBeTruthy()
  })

  it('props.period отсутствует → контрол периода не рендерится', () => {
    render(<ListNode node={periodNode(undefined)} />)
    expect(screen.queryByTestId('date-input-table.periodFrom')).toBeNull()
    expect(screen.queryByTestId('date-input-table.periodTo')).toBeNull()
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

  it('без TypeCode (нет activate-команды с двоеточием) контрол периода не рендерится', () => {
    const node = {
      id: 'lst',
      type: 'LIST',
      props: {
        source: { url: '/x/search', method: 'POST' },
        period: { from: null, to: null },
      },
      children: [],
      actions: [],
    } as unknown as ViewNode
    render(<ListNode node={node} />)
    expect(screen.queryByTestId('date-input-table.periodFrom')).toBeNull()
  })
})

describe('ListNode — 2c-a: воронка колоночного фильтра', () => {
  afterEach(() => {
    cleanup()
  })

  // TypeCode — тот же источник, что в 2b/2d: суффикс после первого двоеточия
  // в команде активации строки (list.rowOpen:{TypeCode}).
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
      actions: [{ trigger: 'activate', command: 'list.rowOpen:TypeX' }],
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
    container.querySelectorAll('thead th')

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

  it('без TypeCode воронка не рендерится (fail-closed)', () => {
    const node = {
      ...filterableNode(),
      actions: [],
    } as unknown as ViewNode
    const { container } = render(<ListNode node={node} />)
    expect(container.querySelector('[aria-label="table.filter"]')).toBeNull()
  })
})
