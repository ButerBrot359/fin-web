import type { ReactElement } from 'react'
import {
  render as rtlRender,
  screen,
  cleanup,
  fireEvent,
} from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { TableNode } from './table-node'

// usePagedTableRows (SCRUM-368) внутри таблицы требует QueryClient
const render = (ui: ReactElement) =>
  rtlRender(
    <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>
  )

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: 'backend', init: () => undefined },
}))

const state: Record<string, unknown> = {}
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({
    getValue: (b?: string) => (b ? state[b] : undefined),
  }),
  useBindingValue: (b?: string) => (b ? state[b] : undefined),
}))

vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => vi.fn(),
}))

const makeTable = (props: Record<string, unknown>): ViewNode =>
  ({
    id: 'tbl',
    type: 'TABLE',
    binding: 'rows',
    props: { editable: false, ...props },
    children: [
      { id: 'c.a', type: 'TABLE_COLUMN', binding: 'a', props: { label: 'A' } },
    ],
  }) as ViewNode

beforeEach(() => {
  cleanup()
  delete state.rows
})

describe('ReadOnlyTable showRowNumbers', () => {
  it('с флагом рендерит ведущую колонку N со значениями 1..n', () => {
    state.rows = [
      { rowId: 'r1', a: 'x' },
      { rowId: 'r2', a: 'y' },
    ]
    render(<TableNode node={makeTable({ showRowNumbers: true })} />)
    expect(screen.getByText('table.rowNumber')).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
  })

  it('без флага колонки N нет', () => {
    state.rows = [{ rowId: 'r1', a: 'x' }]
    render(<TableNode node={makeTable({})} />)
    expect(screen.queryByText('table.rowNumber')).toBeNull()
  })
})

// Ресайз read-only таблицы (движения): рендер ручной, без TanStack — ширины
// едут через <colgroup>, ручки ставятся только на листовые ячейки шапки.
describe('ReadOnlyTable ресайз колонок', () => {
  const nodeWithGroups = (props: Record<string, unknown>): ViewNode =>
    ({
      id: 'tbl',
      type: 'TABLE',
      binding: 'rows',
      props: { editable: false, ...props },
      children: [
        {
          id: 'tbl.col.period',
          type: 'TABLE_COLUMN',
          binding: 'period',
          props: { label: 'Период', width: 120 },
        },
        {
          id: 'tbl.group.dt',
          type: 'COLUMN_GROUP',
          props: { label: 'ДЕБЕТ' },
          children: [
            {
              id: 'tbl.col.dt',
              type: 'TABLE_COLUMN',
              binding: 'dt',
              props: { label: 'Счёт', width: 90, resizable: false },
            },
          ],
        },
      ],
    }) as ViewNode

  // Регресс-пин: без columnsResizable read-only таблица рендерится как раньше.
  it('без columnsResizable ручек и colgroup нет', () => {
    state.rows = [{ rowId: 'r1', period: '01.01.2026', dt: '1010' }]
    const { container } = render(<TableNode node={nodeWithGroups({})} />)
    expect(container.querySelectorAll('[role="separator"]')).toHaveLength(0)
    expect(container.querySelector('colgroup')).toBeNull()
  })

  it('с columnsResizable: ширины в colgroup, ручка только на разрешённом листе', () => {
    state.rows = [{ rowId: 'r1', period: '01.01.2026', dt: '1010' }]
    const { container } = render(
      <TableNode
        node={nodeWithGroups({
          columnsResizable: true,
          columnStateKey: 'movements:Test.Dvizhenie',
        })}
      />
    )
    const cols = [...container.querySelectorAll('colgroup col')]
    expect(cols.map((c) => (c as HTMLElement).style.width)).toEqual([
      '120px',
      '90px',
    ])
    // Групповой заголовок ДЕБЕТ ручки не получает, колонка «Счёт» запрещена бэком.
    expect(container.querySelectorAll('[role="separator"]')).toHaveLength(1)
  })

  it('перетаскивание пишет ширину в localStorage под относительным ключом', () => {
    localStorage.clear()
    state.rows = [{ rowId: 'r1', period: '01.01.2026', dt: '1010' }]
    const { container } = render(
      <TableNode
        node={nodeWithGroups({
          columnsResizable: true,
          columnStateKey: 'movements:Test.Dvizhenie',
        })}
      />
    )
    const handle = container.querySelector('[role="separator"]')!
    fireEvent.mouseDown(handle, { clientX: 100 })
    fireEvent.mouseMove(document, { clientX: 160 })
    fireEvent.mouseUp(document)

    expect(
      JSON.parse(
        localStorage.getItem('sdui-col-widths:movements:Test.Dvizhenie') ?? '{}'
      )
    ).toEqual({ 'col.period': 180 })
    const cols = [...container.querySelectorAll('colgroup col')]
    expect((cols[0] as HTMLElement).style.width).toBe('180px')
  })
})
