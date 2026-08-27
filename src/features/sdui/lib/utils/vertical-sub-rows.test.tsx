import { cleanup, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../types/view'
import { TableNode } from '../../ui/nodes/composite/table-node'
import { VERTICAL_SUB_ROW_HEIGHT } from './build-column-defs'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: 'backend', init: () => undefined },
}))

const state: Record<string, unknown> = {
  rows: [
    {
      rowId: 'r1',
      // «Сотрудник / Должность»: длинная должность и короткое число рядом —
      // на коротких значениях расхождение высот незаметно.
      sotrudnik: 'Алдамжароваааааа Динара Жуанышевна',
      dolzhnost: 'ГЛАВНЫЙ ЭКОНОМИСТ ОТДЕЛА ПЛАНИРОВАНИЯ И БЮДЖЕТА',
      normaDney: '21',
      otrabotano: '21',
    },
  ],
}
vi.mock('../../lib/sdui-session-context', () => ({
  useSduiSession: () => ({
    getValue: (b?: string) => (b ? state[b] : undefined),
  }),
  useBindingValue: (b?: string) => (b ? state[b] : undefined),
}))
vi.mock('../../lib/dispatch', () => ({ useSduiDispatch: () => vi.fn() }))

const col = (
  id: string,
  binding: string,
  label: string,
  props: Record<string, unknown> = { readonly: true }
): ViewNode =>
  ({
    id,
    type: 'TABLE_COLUMN',
    binding,
    props: { label, ...props },
  }) as ViewNode

const group = (id: string, children: ViewNode[]): ViewNode =>
  ({
    id,
    type: 'COLUMN_GROUP',
    props: { orientation: 'VERTICAL' },
    children,
  }) as ViewNode

const node = (): ViewNode =>
  ({
    id: 'tbl.nachisleniya',
    type: 'TABLE',
    binding: 'rows',
    props: { editable: true },
    children: [
      group('grp.sotrudnik', [
        col('col.sotrudnik', 'sotrudnik', 'Сотрудник'),
        col('col.dolzhnost', 'dolzhnost', 'Должность'),
      ]),
      group('grp.dni', [
        col('col.normaDney', 'normaDney', 'Норма дней'),
        col('col.otrabotano', 'otrabotano', 'Отработано'),
      ]),
      // Редактируемая пара: «Вид начисления / График работы» в эталоне —
      // перечисления, их подписи тоже не должны переноситься.
      group('grp.nachislenie', [
        col('col.vidNachisleniya', 'vidNachisleniya', 'Вид начисления', {
          cellWidget: 'ENUM_FIELD',
          options: [
            {
              value: 'oklad',
              label: 'Оклад по дням',
              id: 1,
              code: 'OkladPoDnyam',
            },
          ],
        }),
        col('col.grafikRaboty', 'grafikRaboty', 'График работы', {
          cellWidget: 'TEXT_FIELD',
        }),
      ]),
    ],
  }) as ViewNode

const renderTable = (ui: ReactElement) =>
  render(
    <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>
  )

afterEach(cleanup)

describe('под-строки вертикальной группы колонок', () => {
  it('под-строка не ниже общего пола и не режет перенесённый текст', () => {
    const { container } = renderTable(<TableNode node={node()} />)
    const subRows = container.querySelectorAll<HTMLElement>(
      'tbody td > div > div'
    )
    // три группы × две под-строки
    expect(subRows).toHaveLength(6)
    for (const row of subRows) {
      expect(row.style.minHeight).toBe(`${String(VERTICAL_SUB_ROW_HEIGHT)}px`)
      expect(row.style.height).toBe('')
    }
  })

  it('длинное значение переносится, как во вкладке без вертикальных групп', () => {
    const { container } = renderTable(<TableNode node={node()} />)
    const longText = Array.from(
      container.querySelectorAll<HTMLElement>('tbody span')
    ).find((el) => el.textContent.startsWith('ГЛАВНЫЙ ЭКОНОМИСТ'))
    expect(longText).toBeTruthy()
    expect(longText?.style.whiteSpace).toBe('normal')
    expect(longText?.style.overflowWrap).toBe('anywhere')
  })
})

describe('редакторы в под-строке вертикальной группы', () => {
  it('текстовый редактор — textarea: значение переносится по ширине колонки', () => {
    const { container } = renderTable(<TableNode node={node()} />)
    expect(container.querySelectorAll('tbody textarea').length).toBeGreaterThan(
      0
    )
  })

  it('подпись перечисления переносится, а не обрезается', () => {
    const { container } = renderTable(<TableNode node={node()} />)
    const select = container.querySelector<HTMLElement>(
      'tbody .MuiSelect-select'
    )
    expect(select).toBeTruthy()
    expect(getComputedStyle(select!).whiteSpace).toBe('normal')
  })
})
