import { describe, expect, it } from 'vitest'

import type {
  AnalyticsColumn,
  AnalyticsQueryColumn,
} from '@/entities/analytics'

import {
  buildTableModel,
  hasTotals,
  sortRows,
  type AnalyticsTableRow,
} from './build-table-model'

const columns: AnalyticsQueryColumn[] = [
  { name: 'dep', type: 'STRING' },
  { name: 'amount', type: 'DECIMAL' },
]

const specColumns: AnalyticsColumn[] = [
  { name: 'dep', label: 'Отдел', type: 'STRING', format: 'PLAIN' },
  {
    name: 'amount',
    label: 'Сумма',
    type: 'DECIMAL',
    format: 'DECIMAL2',
    total: 'SUM',
  },
]

const kinds = (rows: AnalyticsTableRow[]): string[] =>
  rows.map((row) => row.kind)

describe('sortRows', () => {
  it('числовые типы сравнивает как числа, включая строки PostgreSQL numeric', () => {
    const rows = [['10'], ['2'], ['1']]
    expect(sortRows(rows, 0, false, 'DECIMAL')).toEqual([['1'], ['2'], ['10']])
  })

  it('строки сравнивает как текст', () => {
    const rows = [['10'], ['2'], ['1']]
    expect(sortRows(rows, 0, false, 'STRING')).toEqual([['1'], ['10'], ['2']])
  })

  it('даты сравнивает по времени, а не по тексту', () => {
    const rows = [['02.01'], ['2024-01-10'], ['2024-01-02']]
    const sorted = sortRows(
      [['2024-01-10'], ['2024-01-02'], ['2024-02-01']],
      0,
      false,
      'DATE'
    )
    expect(sorted).toEqual([['2024-01-02'], ['2024-01-10'], ['2024-02-01']])
    expect(rows).toHaveLength(3) // исходный массив не мутируется
  })

  it('пустые значения при прямой сортировке уходят вниз', () => {
    const rows = [[null], ['5'], ['3']]
    expect(sortRows(rows, 0, false, 'DECIMAL')).toEqual([['3'], ['5'], [null]])
  })

  it('desc переворачивает порядок', () => {
    const rows = [['1'], ['3'], ['2']]
    expect(sortRows(rows, 0, true, 'DECIMAL')).toEqual([['3'], ['2'], ['1']])
  })

  it('отрицательный индекс возвращает строки как есть', () => {
    const rows = [['b'], ['a']]
    expect(sortRows(rows, -1, false, 'STRING')).toBe(rows)
  })
})

describe('hasTotals', () => {
  it('итоги есть, если хоть у одной колонки задан агрегат', () => {
    expect(hasTotals(specColumns)).toBe(true)
  })

  it('NONE и отсутствие агрегата итогом не считаются', () => {
    expect(hasTotals()).toBe(false)
    expect(
      hasTotals([{ name: 'a', type: 'STRING', format: 'PLAIN', total: 'NONE' }])
    ).toBe(false)
  })
})

describe('buildTableModel', () => {
  const rows = [
    ['A', '10'],
    ['B', '5'],
    ['A', '20'],
  ]

  it('без группировки — данные и общий итог', () => {
    const model = buildTableModel({
      columns,
      rows,
      specColumns,
      totalLabel: 'Итого',
    })

    expect(kinds(model)).toEqual(['data', 'data', 'data', 'total'])
    const total = model[model.length - 1]
    expect(total.label).toBe('Итого')
    expect(total.depth).toBe(0)
    // dep без агрегата — null, amount — сумма
    expect(total.cells).toEqual([null, 35])
  })

  it('showTotals=false убирает итоги даже при настроенных агрегатах', () => {
    const model = buildTableModel({
      columns,
      rows,
      specColumns,
      showTotals: false,
      totalLabel: 'Итого',
    })
    expect(kinds(model)).toEqual(['data', 'data', 'data'])
  })

  it('на пустом результате не рисует строку общего итога', () => {
    const model = buildTableModel({
      columns,
      rows: [],
      specColumns,
      totalLabel: 'Итого',
    })
    expect(model).toEqual([])
  })

  it('groupBy даёт шапки групп, промежуточные и общий итоги', () => {
    const model = buildTableModel({
      columns,
      rows,
      specColumns,
      groupBy: ['dep'],
      totalLabel: 'Итого',
    })

    expect(kinds(model)).toEqual([
      'group', // A
      'data',
      'data',
      'total', // Итого A
      'group', // B
      'data',
      'total', // Итого B
      'total', // общий
    ])

    const [groupA, , , subtotalA] = model
    expect(groupA.label).toBe('A')
    expect(groupA.depth).toBe(0)
    expect(subtotalA.label).toBe('Итого A')
    expect(subtotalA.depth).toBe(1)
    expect(subtotalA.cells).toEqual([null, 30])

    const grand = model[model.length - 1]
    expect(grand.label).toBe('Итого')
    expect(grand.cells).toEqual([null, 35])
  })

  it('неизвестное поле группировки игнорируется, данные не теряются', () => {
    const model = buildTableModel({
      columns,
      rows,
      specColumns,
      groupBy: ['missing'],
      totalLabel: 'Итого',
    })
    expect(kinds(model)).toEqual(['data', 'data', 'data', 'total'])
  })
})
