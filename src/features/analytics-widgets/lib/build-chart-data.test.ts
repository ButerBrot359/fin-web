import { describe, expect, it } from 'vitest'

import type {
  AnalyticsColumn,
  AnalyticsQueryResult,
  AnalyticsValueType,
} from '@/entities/analytics'

import {
  aggregateNumbers,
  buildCartesianData,
  buildPieData,
} from './build-chart-data'
import { buildTableModel } from './build-table-model'
import { colorAt } from './chart-colors'

const queryResult = (
  columns: [string, AnalyticsValueType][],
  rows: unknown[][]
): AnalyticsQueryResult => ({
  columns: columns.map(([name, type]) => ({ name, type })),
  rows,
  rowCount: rows.length,
  truncated: false,
  executionMs: 1,
})

describe('buildCartesianData', () => {
  it('парсит numeric из строк и сохраняет null как разрыв', () => {
    const result = queryResult(
      [
        ['month', 'STRING'],
        ['amount', 'DECIMAL'],
      ],
      [
        ['Январь', '1000.50'],
        ['Февраль', null],
        ['Март', 300],
      ]
    )

    const data = buildCartesianData({
      result,
      encoding: { x: { field: 'month' }, y: [{ field: 'amount' }] },
    })

    expect(data.dataset).toEqual([
      { x: 'Январь', s0: 1000.5 },
      { x: 'Февраль', s0: null },
      { x: 'Март', s0: 300 },
    ])
    expect(data.series).toHaveLength(1)
    // Сверяемся с палитрой, а не с литералом: цвета приходят из канона
    // токенов (`var(--…, #fallback)`), и хардкод здесь ломался бы при
    // каждой правке палитры.
    expect(data.series[0].color).toBe(colorAt(0))
  })

  it('разбивает меру на серии по encoding.series', () => {
    const result = queryResult(
      [
        ['month', 'STRING'],
        ['kbp', 'STRING'],
        ['amount', 'DECIMAL'],
      ],
      [
        ['Янв', '001', '10'],
        ['Янв', '002', '20'],
        ['Фев', '001', '30'],
      ]
    )

    const data = buildCartesianData({
      result,
      encoding: {
        x: { field: 'month' },
        y: [{ field: 'amount' }],
        series: { field: 'kbp' },
      },
    })

    expect(data.series.map((item) => item.label)).toEqual(['001', '002'])
    expect(data.dataset).toEqual([
      { x: 'Янв', s0: 10, s1: 20 },
      { x: 'Фев', s0: 30, s1: null },
    ])
  })
})

describe('buildPieData', () => {
  it('сворачивает хвост длиннее лимита в один сектор', () => {
    const rows = Array.from({ length: 20 }, (_, i) => [
      `К${String(i)}`,
      String(20 - i),
    ])
    const result = queryResult(
      [
        ['name', 'STRING'],
        ['amount', 'DECIMAL'],
      ],
      rows
    )

    const slices = buildPieData({
      result,
      encoding: { label: { field: 'name' }, value: { field: 'amount' } },
    })

    expect(slices).toHaveLength(15)
    expect(slices[14].label).toBe('… (6)')
    // 6 наименьших значений: 6 + 5 + 4 + 3 + 2 + 1
    expect(slices[14].value).toBe(21)
  })
})

describe('aggregateNumbers', () => {
  it('считает свёртки и игнорирует пустые значения', () => {
    const values = [10, null, 20, 30]
    expect(aggregateNumbers(values, 'SUM')).toBe(60)
    expect(aggregateNumbers(values, 'AVG')).toBe(20)
    expect(aggregateNumbers(values, 'MIN')).toBe(10)
    expect(aggregateNumbers(values, 'MAX')).toBe(30)
    expect(aggregateNumbers(values, 'COUNT')).toBe(3)
    expect(aggregateNumbers(values, 'NONE')).toBe(10)
    expect(aggregateNumbers([null, null], 'SUM')).toBeNull()
  })
})

describe('buildTableModel', () => {
  const specColumns: AnalyticsColumn[] = [
    { name: 'kbp', type: 'STRING', format: 'PLAIN' },
    { name: 'amount', type: 'DECIMAL', format: 'MONEY', total: 'SUM' },
  ]
  const columns = [
    { name: 'kbp', type: 'STRING' as const },
    { name: 'amount', type: 'DECIMAL' as const },
  ]
  const rows = [
    ['001', '10'],
    ['001', '20'],
    ['002', '5'],
  ]

  it('добавляет строку общих итогов', () => {
    const model = buildTableModel({
      columns,
      rows,
      specColumns,
      totalLabel: 'Итого',
    })

    expect(model.map((row) => row.kind)).toEqual([
      'data',
      'data',
      'data',
      'total',
    ])
    expect(model[3].cells).toEqual([null, 35])
  })

  it('группирует и считает промежуточные итоги', () => {
    const model = buildTableModel({
      columns,
      rows,
      specColumns,
      groupBy: ['kbp'],
      totalLabel: 'Итого',
    })

    expect(model.map((row) => row.kind)).toEqual([
      'group',
      'data',
      'data',
      'total',
      'group',
      'data',
      'total',
      'total',
    ])
    expect(model[0].label).toBe('001')
    expect(model[3].cells).toEqual([null, 30])
    expect(model[6].cells).toEqual([null, 5])
    expect(model[7].label).toBe('Итого')
  })

  it('без настроенных итогов строку итогов не добавляет', () => {
    const model = buildTableModel({
      columns,
      rows,
      specColumns: [{ name: 'kbp', type: 'STRING', format: 'PLAIN' }],
      totalLabel: 'Итого',
    })

    expect(model).toHaveLength(3)
  })
})
