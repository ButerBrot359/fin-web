import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { TableNode } from './table-node'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: {
    type: 'backend',
    init: () => undefined,
  },
}))

const state: Record<string, unknown> = {}
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({
    getValue: (b?: string) => (b ? state[b] : undefined),
  }),
  useBindingValue: (b?: string) => (b ? state[b] : undefined),
}))
vi.mock('../../../lib/dispatch', () => ({ useSduiDispatch: () => vi.fn() }))

// «План финансирования»: «Общая сумма» залита #CCFFCC, соседняя колонка — нет.
const table = (props: Record<string, unknown> = {}): ViewNode =>
  ({
    id: 'tbl.planFinansirovaniya',
    type: 'TABLE',
    binding: 'rows',
    props: { editable: false, ...props },
    children: [
      {
        id: 'col.period',
        type: 'TABLE_COLUMN',
        binding: 'period',
        props: { label: 'Период' },
      },
      {
        id: 'col.summaItogoPoPeriodam',
        type: 'TABLE_COLUMN',
        binding: 'summa',
        props: { label: 'Общая сумма', backgroundColor: '#CCFFCC' },
      },
    ],
  }) as ViewNode

const cells = () => screen.getAllByRole('cell')

// usePagedTableRows (SCRUM-368) внутри таблицы требует QueryClient
const renderTable = (ui: ReactElement) =>
  render(
    <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>
  )

beforeEach(() => {
  cleanup()
  state.rows = [{ rowId: 'r1', period: 'Январь', summa: '100' }]
})

describe('backgroundColor колонки ТЧ', () => {
  it('залита только колонка с пропом', () => {
    renderTable(<TableNode node={table()} />)
    const [period, summa] = cells()
    expect(getComputedStyle(summa).backgroundColor).toBe('rgb(204, 255, 204)')
    // прозрачный — собственного фона у ячейки нет
    expect(getComputedStyle(period).backgroundColor).toBe('rgba(0, 0, 0, 0)')
  })

  it('условная заливка строки перекрывает заливку колонки', () => {
    state.rows = [{ rowId: 'r1', period: 'Январь', summa: '100', flag: true }]
    renderTable(
      <TableNode
        node={table({
          rowAppearance: [
            { binding: 'flag', equals: true, backgroundColor: 'rgb(1, 2, 3)' },
          ],
        })}
      />
    )
    // у ячейки собственного фона нет — сквозь неё виден фон строки
    expect(getComputedStyle(cells()[1]).backgroundColor).toBe(
      'rgba(0, 0, 0, 0)'
    )
  })
})
