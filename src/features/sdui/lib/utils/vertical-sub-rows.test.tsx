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
      fkr: '360/001/045 (За счет субвенций из республиканского бюджета на образование)',
      kodPlatnykhUslug:
        'Услуги по подготовке специалистов сверх государственного заказа',
      summa: '100',
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
        // Пара «Вид начисления / Способ расчёта»: вторая колонка вне списка
        // исключений — на ней проверяется, что редактор по-прежнему переносит
        // текст (multiline → textarea).
        col('col.sposobRascheta', 'sposobRascheta', 'Способ расчёта', {
          cellWidget: 'TEXT_FIELD',
        }),
      ]),
      // Пара колонок ВНЕ списка исключений (isNoWrapColumn) — на ней и
      // проверяется, что перенос в под-строках работает по-прежнему.
      group('grp.spetsifika', [
        col('col.spetsifika', 'spetsifika', 'Специфика', {
          cellWidget: 'ENUM_FIELD',
          options: [
            {
              value: 'osnovnaya',
              label: 'Основная деятельность за счёт бюджета',
              id: 2,
              code: 'Osnovnaya',
            },
          ],
        }),
        col('col.kodPlatnykhUslug', 'kodPlatnykhUslug', 'Код платных услуг'),
      ]),
      // «ФКР» — в списке исключений: значение эталона «360/001/045 (За счет
      // субвенций из республиканского бюджета на образование)» переносом
      // раздувало каждую строку ТЧ на две (обращение 22.09.2026).
      group('grp.fkr', [
        col('col.fkr', 'fkr', 'ФКР'),
        col('col.summa', 'summa', 'Сумма'),
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
    // пять групп × две под-строки
    expect(subRows).toHaveLength(10)
    for (const row of subRows) {
      expect(row.style.minHeight).toBe(`${String(VERTICAL_SUB_ROW_HEIGHT)}px`)
      expect(row.style.height).toBe('')
    }
  })

  it('длинное значение переносится, как во вкладке без вертикальных групп', () => {
    const { container } = renderTable(<TableNode node={node()} />)
    const longText = Array.from(
      container.querySelectorAll<HTMLElement>('tbody span')
    ).find((el) => el.textContent.startsWith('Услуги по подготовке'))
    expect(longText).toBeTruthy()
    expect(longText?.style.whiteSpace).toBe('normal')
    expect(longText?.style.overflowWrap).toBe('anywhere')
  })

  // «Сотрудник» и «Должность» из правила переноса исключены (isNoWrapColumn):
  // ФИО и наименование должности длинные всегда, и перенос раздувал бы каждую
  // строку ТЧ.
  it('исключённая колонка держит значение в одну строку с многоточием', () => {
    const { container } = renderTable(<TableNode node={node()} />)
    const dolzhnost = Array.from(
      container.querySelectorAll<HTMLElement>('tbody span')
    ).find((el) => el.textContent.startsWith('ГЛАВНЫЙ ЭКОНОМИСТ'))
    expect(dolzhnost).toBeTruthy()
    expect(dolzhnost?.style.whiteSpace).toBe('nowrap')
    expect(dolzhnost?.style.textOverflow).toBe('ellipsis')
  })

  it('«ФКР» держит значение в одну строку — перенос его раздувал', () => {
    const { container } = renderTable(<TableNode node={node()} />)
    const fkr = Array.from(
      container.querySelectorAll<HTMLElement>('tbody span')
    ).find((el) => el.textContent.startsWith('360/001/045'))
    expect(fkr).toBeTruthy()
    expect(fkr?.style.whiteSpace).toBe('nowrap')
    expect(fkr?.style.textOverflow).toBe('ellipsis')
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
    // Второе перечисление таблицы — «Специфика», колонка вне исключений.
    const selects = container.querySelectorAll<HTMLElement>(
      'tbody .MuiSelect-select'
    )
    expect(selects).toHaveLength(2)
    expect(getComputedStyle(selects[1]).whiteSpace).toBe('normal')
  })

  it('перечисление исключённой колонки — одна строка с многоточием', () => {
    const { container } = renderTable(<TableNode node={node()} />)
    // Первое — «Вид начисления», он из переноса исключён.
    const select = container.querySelector<HTMLElement>(
      'tbody .MuiSelect-select'
    )
    expect(getComputedStyle(select!).whiteSpace).toBe('nowrap')
    expect(getComputedStyle(select!).textOverflow).toBe('ellipsis')
  })
})
