import { describe, expect, it } from 'vitest'

import type { ViewNode } from '../../types/view'
import { extractSearchColumns } from './table-column-def'

const column = (
  id: string,
  binding: string,
  props: Record<string, unknown> = {}
): ViewNode => ({ id, type: 'TABLE_COLUMN', binding, props })

const group = (
  id: string,
  orientation: 'VERTICAL' | 'HORIZONTAL',
  children: ViewNode[]
): ViewNode => ({
  id,
  type: 'COLUMN_GROUP',
  props: { orientation },
  children,
})

describe('extractSearchColumns', () => {
  it('под-колонки VERTICAL-группы адресуются ячейкой группы', () => {
    const children: ViewNode[] = [
      column('col.sotrudnik', 'Sotrudnik'),
      group('colgroup.fkrSpetsifika', 'VERTICAL', [
        column('col.istochnik', 'IstochnikFinansirovaniya'),
        column('col.fkr', 'FKR'),
      ]),
      group('colgroup.spetsifikaKodUslug', 'VERTICAL', [
        column('col.spetsifika', 'Spetsifika'),
        column('col.kod', 'KodPlatnykhUslug'),
      ]),
    ]

    expect(extractSearchColumns(children)).toEqual([
      { id: 'col.sotrudnik', binding: 'Sotrudnik' },
      { id: 'colgroup.fkrSpetsifika', binding: 'IstochnikFinansirovaniya' },
      { id: 'colgroup.fkrSpetsifika', binding: 'FKR' },
      { id: 'colgroup.spetsifikaKodUslug', binding: 'Spetsifika' },
      { id: 'colgroup.spetsifikaKodUslug', binding: 'KodPlatnykhUslug' },
    ])
  })

  it('HORIZONTAL-группа отдаёт свои колонки, скрытые не ищутся', () => {
    const children: ViewNode[] = [
      column('col.fizlitso', 'FizicheskoeLitso', { visible: false }),
      group('colgroup.h', 'HORIZONTAL', [
        column('col.a', 'A'),
        column('col.b', 'B', { visible: false }),
      ]),
      group('colgroup.v', 'VERTICAL', [
        column('col.c', 'C'),
        group('colgroup.v.h', 'HORIZONTAL', [
          column('col.d', 'D'),
          column('col.e', 'E', { visible: false }),
        ]),
      ]),
    ]

    expect(extractSearchColumns(children)).toEqual([
      { id: 'col.a', binding: 'A' },
      { id: 'colgroup.v', binding: 'C' },
      { id: 'colgroup.v', binding: 'D' },
    ])
  })
})
