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
      fkr: 'Функциональная классификация расходов 009 001 015',
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
        col('col.fkr', 'fkr', 'ФКР'),
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
    // четыре группы × две под-строки
    expect(subRows).toHaveLength(8)
    for (const row of subRows) {
      expect(row.style.minHeight).toBe(`${String(VERTICAL_SUB_ROW_HEIGHT)}px`)
      expect(row.style.height).toBe('')
    }
  })

  // SCRUM-412 п.2: высота под-строки зафиксирована общей сеткой, а обрезать
  // ячейку по границе нельзя (clip=false из-за рамок редакторов) — перенос в
  // под-строках выключен принудительно, иначе значение вытекает на соседнюю
  // под-строку («буквы друг на друге»).
  it('длинное значение в под-строке — одна строка с многоточием', () => {
    const { container } = renderTable(<TableNode node={node()} />)
    const longText = Array.from(
      container.querySelectorAll<HTMLElement>('tbody span')
    ).find((el) => el.textContent.startsWith('Функциональная классификация'))
    expect(longText).toBeTruthy()
    expect(longText?.style.whiteSpace).toBe('nowrap')
    expect(longText?.style.textOverflow).toBe('ellipsis')
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
})

describe('редакторы в под-строке вертикальной группы', () => {
  // SCRUM-412 п.2: в под-строках перенос выключен — текстовый редактор
  // однострочный <input>, а не textarea (многострочное значение вытекало бы
  // за фиксированную высоту под-строки).
  it('текстовый редактор в под-строке — однострочный input, не textarea', () => {
    const { container } = renderTable(<TableNode node={node()} />)
    expect(container.querySelectorAll('tbody textarea')).toHaveLength(0)
    expect(container.querySelectorAll('tbody input').length).toBeGreaterThan(0)
  })

  it('подпись перечисления в под-строке — одна строка с многоточием', () => {
    const { container } = renderTable(<TableNode node={node()} />)
    // Второе перечисление таблицы — «Специфика», колонка вне исключений, но в
    // под-строке VERTICAL-группы перенос выключен и для неё.
    const selects = container.querySelectorAll<HTMLElement>(
      'tbody .MuiSelect-select'
    )
    expect(selects).toHaveLength(2)
    expect(getComputedStyle(selects[1]).whiteSpace).toBe('nowrap')
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
