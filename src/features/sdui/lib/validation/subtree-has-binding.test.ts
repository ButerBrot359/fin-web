import { describe, expect, it } from 'vitest'

import type { ViewNode } from '../../types/view'
import { subtreeHasBinding } from './subtree-has-binding'

// SCRUM-317 v4 §4.5 — регрессия на дефект 17.09.2026: «Отпуск», поле шапки
// FizicheskoeLitso — одноимённая колонка есть в четырёх ТЧ; сообщение о пустом
// поле шапки перебрасывало на вкладку «Сотрудники».
const tabConditions: ViewNode = {
  id: 'tab1',
  type: 'TAB',
  children: [
    { id: 'f1', type: 'REFERENCE_FIELD', binding: 'FizicheskoeLitso' },
    { id: 'f2', type: 'DATE_FIELD', binding: 'DataS' },
  ],
} as unknown as ViewNode

const tabEmployees: ViewNode = {
  id: 'tab2',
  type: 'TAB',
  children: [
    {
      id: 'tbl',
      type: 'TABLE',
      binding: 'Sotrudniki',
      children: [
        { id: 'col1', type: 'TABLE_COLUMN', binding: 'FizicheskoeLitso' },
      ],
    },
  ],
} as unknown as ViewNode

describe('subtreeHasBinding с видом цели (SCRUM-317 v4 §4.5)', () => {
  it('FIELD: поле шапки НЕ удовлетворяется колонкой ТЧ с тем же кодом', () => {
    expect(subtreeHasBinding(tabEmployees, 'FizicheskoeLitso', 'FIELD')).toBe(
      false
    )
    expect(subtreeHasBinding(tabConditions, 'FizicheskoeLitso', 'FIELD')).toBe(
      true
    )
  })

  it('TABLE_CELL находит узел TABLE по tableCode', () => {
    expect(subtreeHasBinding(tabEmployees, 'Sotrudniki', 'TABLE_CELL')).toBe(
      true
    )
    expect(subtreeHasBinding(tabConditions, 'Sotrudniki', 'TABLE_CELL')).toBe(
      false
    )
  })

  it('TABLE не удовлетворяется полем шапки с тем же кодом', () => {
    const tab = {
      id: 't',
      type: 'TAB',
      children: [{ id: 'f', type: 'TEXT_FIELD', binding: 'Sotrudniki' }],
    } as unknown as ViewNode
    expect(subtreeHasBinding(tab, 'Sotrudniki', 'TABLE')).toBe(false)
  })

  it('неизвестный вид (null, легаси-канал) работает как раньше — по одному binding', () => {
    expect(subtreeHasBinding(tabEmployees, 'FizicheskoeLitso', null)).toBe(true)
    expect(subtreeHasBinding(tabEmployees, 'FizicheskoeLitso')).toBe(true)
  })
})
