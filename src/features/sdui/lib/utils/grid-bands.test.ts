import { describe, expect, it } from 'vitest'

import type { ViewNode } from '../../types/view'
import { layoutGridCells } from './grid-bands'

const cell = (
  id: string,
  lane: number,
  slot: number,
  props: Record<string, unknown> = {}
): ViewNode =>
  ({
    id,
    type: 'TEXT_FIELD',
    props: {
      gridBand: 'row.header',
      gridLane: lane,
      gridSlot: slot,
      colStart: lane * 12 + 1,
      colSpan: 12,
      ...props,
    },
  }) as ViewNode

const spacer = (id: string, lane: number): ViewNode =>
  ({
    id,
    type: 'SPACER',
    props: {
      gridBand: 'row.header',
      gridLane: lane,
      gridSlot: -1,
      colSpan: 12,
    },
  }) as ViewNode

const ids = (nodes: ViewNode[]) => nodes.map((n) => n.id)

describe('layoutGridCells (полосы грид-шапки)', () => {
  it('скрытое поле колонки не оставляет дыры: поля ниже поднимаются, соседняя колонка не сдвигается', () => {
    const children = [
      cell('vidOp', 0, 0),
      cell('period', 1, 0),
      cell('nomer', 0, 1),
      cell('istochnik', 1, 1),
      cell('org', 0, 2),
      cell('fkr', 1, 2, { visible: false }),
      cell('podr', 0, 3),
      cell('spetsifika', 1, 4),
      cell('vidNach', 0, 4),
      cell('uchityvat', 1, 5),
    ]

    expect(ids(layoutGridCells(children))).toEqual([
      'vidOp',
      'period',
      'nomer',
      'istochnik',
      'org',
      'spetsifika',
      'podr',
      'uchityvat',
      'vidNach',
    ])
  })

  it('показанное патчем поле встаёт в своей колонке по своей позиции', () => {
    const children = [
      cell('org', 0, 0),
      cell('istochnik', 1, 0),
      cell('podr', 0, 1),
      spacer('spacer.grid.1', 1),
      cell('fkr', 1, 1),
    ]

    expect(ids(layoutGridCells(children))).toEqual([
      'org',
      'istochnik',
      'podr',
      'fkr',
    ])
  })

  it('ячейки одной позиции (Номер + Дата) остаются в одной строке', () => {
    const children = [
      cell('nomer', 0, 0, { colSpan: 6 }),
      cell('data', 0, 0, { colStart: 7, colSpan: 6 }),
      cell('istochnik', 1, 0),
      cell('org', 0, 1),
    ]

    expect(ids(layoutGridCells(children))).toEqual([
      'nomer',
      'data',
      'istochnik',
      'org',
    ])
  })

  it('ноды вне полос идут как есть, скрытые и без полосы отсеиваются', () => {
    const plain = {
      id: 'kommentariy',
      type: 'TEXT_FIELD',
      props: {},
    } as ViewNode
    const hidden = {
      id: 'tail',
      type: 'TEXT_FIELD',
      props: { visible: false },
    } as ViewNode

    expect(
      ids(
        layoutGridCells([
          cell('org', 0, 0),
          plain,
          hidden,
          cell('istochnik', 1, 0),
        ])
      )
    ).toEqual(['org', 'istochnik', 'kommentariy'])
  })
})
