import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { TableNode } from './table-node'

/**
 * Подвал колонок, лежащих ВНУТРИ вертикальной группы.
 *
 * Дефект 04.09.2026 («Больничный лист», ТЧ «Средний заработок»): из восьми
 * итогов отрисовывались ровно четыре — те, чьи колонки лежат в TABLE напрямую;
 * четыре внутри COLUMN_GROUP пропадали, хотя `footer=true` стоит на всех восьми
 * (миграция падает, если проставилось меньше). Причина — вертикальная группа
 * рендерится ОДНОЙ колонкой TanStack, и `columnDef.footer` под-колонок терялся.
 *
 * Ключ карты `<binding>.footer` — id УЗЛА колонки, а не binding (карта плоская,
 * вложенности групп в ней нет).
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ru' } }),
  initReactI18next: { type: 'backend', init: () => undefined },
}))

const state: Record<string, unknown> = {
  rows: [
    {
      rowId: 'r1',
      rezultat: '10',
      otrabotannoDney: '20',
      otrabotannoChasov: '7',
    },
  ],
  'rows.footer': {
    'col.rezultat': '10 000,00',
    'col.otrabotannoDney': '20',
    'col.otrabotannoChasov': '7',
  },
}
vi.mock('../../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({
    getValue: (b?: string) => (b ? state[b] : undefined),
    setValue: () => undefined,
    setFromServer: () => undefined,
  }),
  useBindingValue: (b?: string) => (b ? state[b] : undefined),
}))
vi.mock('../../../lib/dispatch', () => ({ useSduiDispatch: () => vi.fn() }))

const col = (id: string, binding: string, label: string): ViewNode =>
  ({
    id,
    type: 'TABLE_COLUMN',
    binding,
    props: { label, readonly: true, footer: true },
  }) as ViewNode

const node = (): ViewNode =>
  ({
    id: 'table.sredniyzarabotok',
    type: 'TABLE',
    binding: 'rows',
    props: { editable: true },
    children: [
      // Колонка вне группы — её итог рисовался и до фикса (контроль регресса).
      col('col.rezultat', 'rezultat', 'Результат'),
      {
        id: 'grp.otrabotano',
        type: 'COLUMN_GROUP',
        props: { orientation: 'VERTICAL' },
        children: [
          col('col.otrabotannoDney', 'otrabotannoDney', 'Отработано дней'),
          col('col.otrabotannoChasov', 'otrabotannoChasov', 'Отработано часов'),
        ],
      } as ViewNode,
    ],
  }) as ViewNode

const renderTable = (ui: ReactElement) =>
  render(
    <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>
  )

afterEach(cleanup)

describe('подвал ТЧ: колонки внутри вертикальной группы', () => {
  it('итоги под-колонок группы выводятся стопкой, как и сами значения', () => {
    const { container } = renderTable(<TableNode node={node()} />)

    const footer = container.querySelector('tfoot')
    expect(footer).toBeTruthy()
    expect(footer?.textContent).toContain('20')
    expect(footer?.textContent).toContain('7')
  })

  it('итог колонки вне группы остаётся на месте', () => {
    const { container } = renderTable(<TableNode node={node()} />)

    expect(container.querySelector('tfoot')?.textContent).toContain('10 000,00')
  })

  it('слоты стопки итогов совпадают по числу с под-колонками группы', () => {
    const { container } = renderTable(<TableNode node={node()} />)

    const stackSlots = container.querySelectorAll('tfoot td > div > div')
    expect(stackSlots).toHaveLength(2)
  })

  it('подвал не рисуется, когда сервер не прислал значений итогов', () => {
    const saved = state['rows.footer']
    delete state['rows.footer']
    try {
      const { container } = renderTable(<TableNode node={node()} />)
      expect(container.querySelector('tfoot')).toBeNull()
    } finally {
      state['rows.footer'] = saved
    }
  })

  it('строки таблицы остаются на месте (подвал их не подменяет)', () => {
    renderTable(<TableNode node={node()} />)
    expect(screen.getAllByRole('row').length).toBeGreaterThan(1)
  })
})
