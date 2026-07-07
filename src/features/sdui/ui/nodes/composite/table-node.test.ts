import { describe, expect, it } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { buildHeaderModel, extractReadOnlyColumns } from './table-node'

const col = (id: string, label: string, binding: string): ViewNode =>
  ({ id, type: 'TABLE_COLUMN', props: { label, binding } }) as unknown as ViewNode

const group = (id: string, label: string, children: ViewNode[]): ViewNode =>
  ({
    id,
    type: 'COLUMN_GROUP',
    props: { label, orientation: 'HORIZONTAL' },
    children,
  }) as unknown as ViewNode

const flatChildren = [col('c1', 'Период', '_period'), col('c2', 'Сумма', '_summa')]

const groupedChildren = [
  col('c1', 'Период', '_period'),
  group('g.dt', 'ДЕБЕТ', [
    col('c2', 'Счёт', '_accountDtCode'),
    col('c3', 'ФКР', '_fkrDt'),
  ]),
  group('g.kt', 'КРЕДИТ', [col('c4', 'Счёт', '_accountKtCode')]),
  col('c5', 'Сумма', '_summa'),
]

describe('extractReadOnlyColumns', () => {
  it('плоские TABLE_COLUMN — как раньше', () => {
    expect(extractReadOnlyColumns(flatChildren).map((c) => c.binding)).toEqual([
      '_period',
      '_summa',
    ])
  })

  it('рекурсивно собирает листья COLUMN_GROUP в порядке документа', () => {
    expect(extractReadOnlyColumns(groupedChildren).map((c) => c.binding)).toEqual([
      '_period',
      '_accountDtCode',
      '_fkrDt',
      '_accountKtCode',
      '_summa',
    ])
  })

  it('undefined children → пустой массив', () => {
    expect(extractReadOnlyColumns(undefined)).toEqual([])
  })
})

describe('buildHeaderModel', () => {
  it('без групп: hasGroups=false, один ряд, colSpan/rowSpan не проставлены', () => {
    const m = buildHeaderModel(flatChildren)
    expect(m.hasGroups).toBe(false)
    expect(m.bottomRow).toEqual([])
    expect(m.topRow.map((c) => c.label)).toEqual(['Период', 'Сумма'])
    expect(m.topRow.every((c) => c.colSpan === undefined && c.rowSpan === undefined)).toBe(true)
  })

  it('с группами: группа → colSpan=числу листьев (по центру), плоская колонка → rowSpan=2, листья → нижний ряд', () => {
    const m = buildHeaderModel(groupedChildren)
    expect(m.hasGroups).toBe(true)
    expect(m.topRow).toEqual([
      { id: 'c1', label: 'Период', rowSpan: 2 },
      { id: 'g.dt', label: 'ДЕБЕТ', colSpan: 2, align: 'center' },
      { id: 'g.kt', label: 'КРЕДИТ', colSpan: 1, align: 'center' },
      { id: 'c5', label: 'Сумма', rowSpan: 2 },
    ])
    expect(m.bottomRow.map((c) => c.label)).toEqual(['Счёт', 'ФКР', 'Счёт'])
  })
})
