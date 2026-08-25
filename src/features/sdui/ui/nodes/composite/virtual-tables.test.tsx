import type { ReactElement } from 'react'
import { cleanup, render as rtlRender } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'

// usePagedTableRows (SCRUM-368) внутри таблиц требует QueryClient
const render = (ui: ReactElement) =>
  rtlRender(
    <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>
  )

// Окно виртуализатора детерминировано: индексы 5..14 (высота строки 30) —
// так проверяются обе распорки и абсолютная нумерация строк.
const WINDOW_START = 5
const WINDOW_SIZE = 10
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (cfg: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: Math.min(WINDOW_SIZE, cfg.count) }, (_, i) => {
        const index = WINDOW_START + i
        return { index, start: index * 30, end: (index + 1) * 30, key: index }
      }),
    getTotalSize: () => cfg.count * 30,
    measureElement: () => undefined,
    scrollToIndex: () => undefined,
  }),
}))

const { mockDispatch } = vi.hoisted(() => ({
  mockDispatch: vi.fn().mockResolvedValue(true),
}))
const sessionState: Record<string, unknown> = {}
vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => mockDispatch,
}))
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({
    setValue: (b: string, v: unknown) => {
      sessionState[b] = v
    },
    setFromServer: (b: string, v: unknown) => {
      sessionState[b] = v
    },
    getValue: (b?: string) => (b ? sessionState[b] : undefined),
  }),
  useBindingValue: (b?: string) => (b ? sessionState[b] : undefined),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: 'ru' },
  }),
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  initReactI18next: { type: 'backend', init: () => {} },
}))
vi.mock('@/app/config/i18n', () => ({ default: { language: 'ru' } }))

import { TableNode } from './table-node'
import { EditableTable } from './editable-table'
import { AccountingPostingsBlock } from './accounting-postings-block'

// jsdom не реализует ResizeObserver, который use-virtual-table-rows вешает на
// скролл-предка.
beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn()
      disconnect = vi.fn()
      unobserve = vi.fn()
    }
  )
})

afterEach(() => {
  cleanup()
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  for (const k of Object.keys(sessionState)) delete sessionState[k]
  mockDispatch.mockClear()
})

/** Обёртка со скролл-предком: по ней use-virtual-table-rows включает окно. */
const Scrollable = ({ children }: { children: React.ReactNode }) => (
  <div style={{ overflowY: 'auto', height: 300 }}>{children}</div>
)

const rows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    rowId: `r${String(i + 1)}`,
    Naimenovanie: `item-${String(i + 1)}`,
  }))

const column: ViewNode = {
  id: 'tbl.col.Naimenovanie',
  type: 'TABLE_COLUMN',
  binding: 'Naimenovanie',
  props: { dataType: 'STRING', cellWidget: 'TEXT_FIELD', label: 'Имя' },
}

describe('виртуализация read-only TABLE (SCRUM-368)', () => {
  const node = (): ViewNode => ({
    id: 'tbl',
    type: 'TABLE',
    binding: 'Tch',
    props: { editable: false, showRowNumbers: true },
    children: [column],
  })

  it('выше порога: в DOM только окно строк + распорки, нумерация абсолютная', () => {
    sessionState.Tch = rows(100)
    const { container } = render(
      <Scrollable>
        <TableNode node={node()} />
      </Scrollable>
    )
    const trs = container.querySelectorAll('tbody tr')
    // 10 строк окна + верхняя и нижняя распорки
    expect(trs).toHaveLength(WINDOW_SIZE + 2)
    // Первая строка окна — абсолютный индекс 5 → номер «6», содержимое item-6
    expect(trs[1].textContent).toContain('6')
    expect(trs[1].textContent).toContain('item-6')
  })

  it('ниже порога: все строки в DOM, распорок нет', () => {
    sessionState.Tch = rows(10)
    const { container } = render(
      <Scrollable>
        <TableNode node={node()} />
      </Scrollable>
    )
    expect(container.querySelectorAll('tbody tr')).toHaveLength(10)
  })
})

describe('виртуализация EditableTable (SCRUM-368)', () => {
  const node = (): ViewNode => ({
    id: 'tbl',
    type: 'TABLE',
    binding: 'Tch',
    props: { editable: true, showRowNumbers: true },
    children: [column],
  })
  const columns = [
    {
      id: 'tbl.col.Naimenovanie',
      label: 'Имя',
      binding: 'Naimenovanie',
      cellWidget: 'TEXT_FIELD',
      dataType: 'STRING',
      props: {},
    },
  ]

  it('выше порога: окно строк + распорки, инпуты только у окна', () => {
    sessionState.Tch = rows(100)
    const { container } = render(
      <Scrollable>
        <EditableTable node={node()} columns={columns} />
      </Scrollable>
    )
    const trs = container.querySelectorAll('tbody tr')
    expect(trs).toHaveLength(WINDOW_SIZE + 2)
    // Инпутов ровно на окно, не на все 100 строк
    expect(
      container.querySelectorAll('tbody input').length
    ).toBeLessThanOrEqual(WINDOW_SIZE)
    expect(trs[1].textContent).toContain('6')
  })

  it('ниже порога: все строки в DOM', () => {
    sessionState.Tch = rows(10)
    const { container } = render(
      <Scrollable>
        <EditableTable node={node()} columns={columns} />
      </Scrollable>
    )
    expect(container.querySelectorAll('tbody tr')).toHaveLength(10)
  })
})

describe('виртуализация журнала проводок (SCRUM-368)', () => {
  // SCRUM-362 B-3: раскладка блока — из ролей колонок (props.role), без роли
  // колонка в блок не попадает; content/period — смысловые роли вне сетки.
  const node = (): ViewNode => ({
    id: 'tbl',
    type: 'TABLE',
    binding: 'Zhurnal',
    props: { regKind: 'ACCOUNTING', editable: false },
    children: [
      {
        id: 'c.period',
        type: 'TABLE_COLUMN',
        binding: '_period',
        props: { label: 'Дата', role: 'period' },
      },
      {
        id: 'c.soderzhanie',
        type: 'TABLE_COLUMN',
        binding: '_soderzhanie',
        props: { label: 'Содержание', role: 'content' },
      },
      {
        id: 'c.subDt1',
        type: 'TABLE_COLUMN',
        binding: '_subkontoDt1',
        props: { label: 'Субконто Дт', role: 'blockDt:1:0' },
      },
      {
        id: 'c.subKt1',
        type: 'TABLE_COLUMN',
        binding: '_subkontoKt1',
        props: { label: 'Субконто Кт', role: 'blockKt:1:0' },
      },
    ],
  })
  const blockRows = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      rowId: `p${String(i + 1)}`,
      _period: '07.07.2026 10:15:30',
      _accountDtCode: '1080',
      _accountKtCode: '3010',
      _summa: '100.00',
      _soderzhanie: `posting-${String(i + 1)}`,
      _subkontoDt1: 'x',
      _subkontoKt1: 'y',
    }))

  it('выше порога: в DOM только окно блоков + tbody-распорки', () => {
    sessionState.Zhurnal = blockRows(30)
    const { container } = render(<AccountingPostingsBlock node={node()} />)
    const bodies = container.querySelectorAll('tbody')
    // 10 блоков окна + верхняя и нижняя распорки
    expect(bodies).toHaveLength(WINDOW_SIZE + 2)
    // Первый блок окна — абсолютный номер 6
    expect(bodies[1].textContent).toContain('posting-6')
  })

  it('ниже порога: все блоки в DOM, распорок нет', () => {
    sessionState.Zhurnal = blockRows(5)
    const { container } = render(<AccountingPostingsBlock node={node()} />)
    expect(container.querySelectorAll('tbody')).toHaveLength(5)
  })
})
