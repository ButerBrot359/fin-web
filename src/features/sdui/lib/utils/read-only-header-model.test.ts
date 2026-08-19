import { describe, expect, it } from 'vitest'

import type { ViewNode } from '../../types/view'
import {
  buildHeaderModel,
  extractReadOnlyColumns,
  isLeafHeaderCell,
} from './read-only-header-model'

const col = (id: string, label: string, binding: string): ViewNode =>
  ({
    id,
    type: 'TABLE_COLUMN',
    props: { label, binding },
  }) as unknown as ViewNode

const group = (id: string, label: string, children: ViewNode[]): ViewNode =>
  ({
    id,
    type: 'COLUMN_GROUP',
    props: { label, orientation: 'HORIZONTAL' },
    children,
  }) as unknown as ViewNode

const flatChildren = [
  col('c1', 'Период', '_period'),
  col('c2', 'Сумма', '_summa'),
]

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
    expect(
      extractReadOnlyColumns(groupedChildren).map((c) => c.binding)
    ).toEqual([
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
    expect(
      m.topRow.every((c) => c.colSpan === undefined && c.rowSpan === undefined)
    ).toBe(true)
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

  it('пустая COLUMN_GROUP пропускается: hasGroups=false, плоская колонка без rowSpan', () => {
    const childrenWithEmptyGroup = [
      col('c1', 'Период', '_period'),
      group('g.empty', 'Пустая', []),
    ]
    const m = buildHeaderModel(childrenWithEmptyGroup)
    expect(m.hasGroups).toBe(false)
    expect(m.bottomRow).toEqual([])
    expect(m.topRow).toEqual([{ id: 'c1', label: 'Период' }])
    expect(
      m.topRow.every((c) => c.colSpan === undefined && c.rowSpan === undefined)
    ).toBe(true)
  })
})

// §111/§273 спеки сложных таблиц: колонка с props.visible=false не рендерится
// ни в шапке, ни в ячейках. Read-only таблица только показывает данные, поэтому
// скрытая колонка выпадает из модели целиком.
describe('visible: false', () => {
  const hidden = (id: string, label: string, binding: string): ViewNode =>
    ({
      id,
      type: 'TABLE_COLUMN',
      props: { label, binding, visible: false },
    }) as unknown as ViewNode

  it('скрытая плоская колонка не попадает ни в колонки, ни в шапку', () => {
    const children = [
      col('c1', 'Период', '_period'),
      hidden('c2', 'Оклад', 'oklad'),
    ]
    expect(extractReadOnlyColumns(children).map((c) => c.id)).toEqual(['c1'])
    expect(buildHeaderModel(children).topRow.map((c) => c.id)).toEqual(['c1'])
  })

  it('скрытый лист группы не считается в colSpan', () => {
    const children = [
      group('g.dt', 'ДЕБЕТ', [
        col('c2', 'Счёт', '_accountDtCode'),
        hidden('c3', 'Ключ связи', 'vychetIPNKey'),
      ]),
    ]
    const model = buildHeaderModel(children)
    expect(model.topRow[0].colSpan).toBe(1)
    expect(model.bottomRow.map((c) => c.id)).toEqual(['c2'])
  })

  // Группа целиком скрыта — исчезает вместе с листьями, а таблица считается
  // «без групп» (иначе осталась бы пустая вторая строка шапки).
  it('скрытая группа выпадает целиком', () => {
    const children = [
      col('c1', 'Период', '_period'),
      {
        id: 'g.hidden',
        type: 'COLUMN_GROUP',
        props: { label: 'Служебные', visible: false },
        children: [col('c9', 'Ключ', 'key')],
      } as unknown as ViewNode,
    ]
    const model = buildHeaderModel(children)
    expect(model.hasGroups).toBe(false)
    expect(model.topRow.map((c) => c.id)).toEqual(['c1'])
    expect(extractReadOnlyColumns(children).map((c) => c.id)).toEqual(['c1'])
  })
})

// Ручка ресайза ставится только на листовые ячейки шапки; отдельного признака в
// модели нет — признак «лист» = отсутствие colSpan (у группы он всегда есть).
describe('isLeafHeaderCell', () => {
  it('групповая ячейка (colSpan) — не лист, плоская колонка и нижний ряд — листья', () => {
    const m = buildHeaderModel(groupedChildren)
    expect(m.topRow.filter(isLeafHeaderCell).map((c) => c.id)).toEqual([
      'c1',
      'c5',
    ])
    expect(m.bottomRow.every(isLeafHeaderCell)).toBe(true)
  })
})
