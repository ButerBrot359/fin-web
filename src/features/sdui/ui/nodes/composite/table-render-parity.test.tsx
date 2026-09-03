import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { TABLE_GRID_SX } from './table-grid-sx'
import { TableNode } from './table-node'

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
vi.mock('../../../lib/dispatch', () => ({ useSduiDispatch: () => vi.fn() }))

const column = (id: string, binding: string, label: string): ViewNode =>
  ({
    id,
    type: 'TABLE_COLUMN',
    binding,
    props: { label, readonly: true },
  }) as ViewNode

/** «Вычеты ИПН»: колонки плоским списком, без COLUMN_GROUP. */
const flatTable = (props: Record<string, unknown> = {}): ViewNode =>
  ({
    id: 'tbl.vychetyIPN',
    type: 'TABLE',
    binding: 'rows',
    props: { editable: false, ...props },
    children: [
      column('col.mesyats', 'mesyats', 'Месяц'),
      column('col.summa', 'summa', 'Сумма'),
    ],
  }) as ViewNode

const table = () => document.querySelector('table') as HTMLElement

// usePagedTableRows (SCRUM-368) внутри таблицы требует QueryClient
const renderTable = (ui: ReactElement) =>
  render(
    <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>
  )

beforeEach(() => {
  cleanup()
  state.rows = [{ rowId: 'r1', mesyats: 'Январь', summa: '100' }]
})

describe('сетка ТЧ', () => {
  // SCRUM-312 (макет «Журнал проводок»): вертикальных линий больше нет —
  // колонки разделяет воздух, строки — горизонтальный разделитель ui-03,
  // низ шапки — тёмная линия ui-06. Каскад дескендант-селекторов sx в jsdom
  // неполон, поэтому пиним сам объект стиля, а рендер — смоуком.
  it('стиль по макету: горизонтали ui-03, тёмный низ шапки, без вертикалей', () => {
    expect(TABLE_GRID_SX).toEqual({
      '& .MuiTableCell-root': { borderBottomColor: '#c3cee0' },
      '& .MuiTableHead-root .MuiTableRow-root:last-child .MuiTableCell-root, & .MuiTableHead-root .MuiTableCell-root[rowspan]':
        { borderBottomColor: '#222124' },
    })
    expect(JSON.stringify(TABLE_GRID_SX)).not.toContain('borderRight')
    renderTable(<TableNode node={flatTable()} />)
    expect(screen.getAllByRole('cell').length).toBeGreaterThan(0)
  })
})

describe('textColor таблицы', () => {
  it('красит текст ячеек', () => {
    renderTable(<TableNode node={flatTable({ textColor: '#B22222' })} />)
    expect(getComputedStyle(screen.getAllByRole('cell')[0]).color).toBe(
      'rgb(178, 34, 34)'
    )
  })

  it('без пропа цвет не задаётся таблицей', () => {
    renderTable(<TableNode node={flatTable()} />)
    expect(getComputedStyle(screen.getAllByRole('cell')[0]).color).not.toBe(
      'rgb(178, 34, 34)'
    )
    expect(table()).toBeTruthy()
  })
})
