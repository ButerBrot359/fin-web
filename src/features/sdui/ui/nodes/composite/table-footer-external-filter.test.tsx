import { cleanup, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { TableNode } from './table-node'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ru' } }),
  initReactI18next: { type: 'backend', init: () => undefined },
}))

const state: Record<string, unknown> = {}
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({
    getValue: (b?: string) => (b ? state[b] : undefined),
    setValue: () => undefined,
    setFromServer: () => undefined,
  }),
  useBindingValue: (b?: string) => (b ? state[b] : undefined),
}))
vi.mock('../../../lib/dispatch', () => ({ useSduiDispatch: () => vi.fn() }))

const node = (): ViewNode =>
  ({
    id: 'table.nachisleniya',
    type: 'TABLE',
    binding: 'Nachisleniya',
    props: {
      editable: true,
      filterSource: 'OtborSotrudnikov',
      filterSourceColumn: 'Sotrudnik',
      filterColumn: 'Sotrudnik',
    },
    children: [
      {
        id: 'table.nachisleniya.col.rezultat',
        type: 'TABLE_COLUMN',
        binding: 'Rezultat',
        props: { label: 'Результат', readonly: true, footer: true },
      },
    ],
  }) as ViewNode

const renderTable = (ui: ReactElement) =>
  render(
    <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>
  )

const A = { id: 263434, presentation: 'Алдамжарова' }
const B = { id: 263453, presentation: 'Андосов' }

const nastroit = (vybran: string | null) => {
  state.Nachisleniya = [
    { rowId: 'r1', Sotrudnik: A, Rezultat: '330252' },
    { rowId: 'r2', Sotrudnik: A, Rezultat: '141536' },
    { rowId: 'r3', Sotrudnik: B, Rezultat: '136884' },
    { rowId: 'r4', Sotrudnik: B, Rezultat: '58665' },
  ]
  state.OtborSotrudnikov = [
    { rowId: '263434', Sotrudnik: A },
    { rowId: '263453', Sotrudnik: B },
  ]
  state['OtborSotrudnikov.__selectedRowId'] = vybran
  // Сервер ещё не ответил на выбор — в состоянии лежит итог ПРЕДЫДУЩЕГО отбора.
  state['Nachisleniya.footer'] = {
    'table.nachisleniya.col.rezultat': '3141484',
  }
}

afterEach(cleanup)

describe('подвал ТЧ под внешним отбором', () => {
  it('отобрана одна строка списка → итог по показанным строкам, а не по всей ТЧ', () => {
    nastroit('263434')

    const { container } = renderTable(<TableNode node={node()} />)

    const footer = container.querySelector('tfoot')?.textContent ?? ''
    expect(footer).toContain('471788')
    expect(footer).not.toContain('3141484')
  })

  it('отбор снят → итог по всем строкам, не дожидаясь ответа сервера', () => {
    nastroit(null)
    // Сервер ещё не ответил на снятие отбора: в состоянии лежит итог по
    // Андосову (136884 + 58665) — ровно то, что видел тестировщик после
    // нажатия «Показать всех».
    state['Nachisleniya.footer'] = {
      'table.nachisleniya.col.rezultat': '195549',
    }

    const { container } = renderTable(<TableNode node={node()} />)

    const footer = container.querySelector('tfoot')?.textContent ?? ''
    expect(footer).toContain('667337')
    expect(footer).not.toContain('195549')
  })

  it('таблица без внешнего отбора берёт итог сервера как есть', () => {
    nastroit(null)
    const bezOtbora = node()
    bezOtbora.props = { editable: true }

    const { container } = renderTable(<TableNode node={bezOtbora} />)

    expect(container.querySelector('tfoot')?.textContent ?? '').toContain(
      '3141484'
    )
  })
})
