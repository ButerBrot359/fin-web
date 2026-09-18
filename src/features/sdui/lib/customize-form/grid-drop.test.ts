import { describe, expect, it } from 'vitest'

import type { GridItem, GridZone } from './grid-zones'
import { applyGridDrop, findGridItem } from './grid-drop'

const item = (nodeId: string, span = 8): GridItem => ({
  nodeId,
  label: nodeId,
  span,
  hidden: false,
  homeZoneId: 'zone',
})

const zone = (rows: GridItem[][]): GridZone => ({
  zoneId: 'zone',
  title: '',
  rows,
})

const ids = (zones: GridZone[]): string[][] =>
  zones[0].rows.map((row) => row.map((i) => i.nodeId))

describe('applyGridDrop: компенсации индексов', () => {
  it('перенос новой строкой из опустевшей строки-источника: индекс цели компенсируется', () => {
    // [a], [b], [c] → a бросается МЕЖДУ [b] и [c] (separator rowIndex=2).
    // Строка-источник [a] пустеет и стоит ВЫШЕ цели — без компенсации a
    // уехал бы в самый конец.
    const zones = [zone([[item('a')], [item('b')], [item('c')]])]

    const next = applyGridDrop(zones, 'a', {
      zoneIndex: 0,
      rowIndex: 2,
      itemIndex: 0,
      newRow: true,
    })

    expect(ids(next)).toEqual([['b'], ['a'], ['c']])
  })

  it('перестановка внутри своей строки: удаление источника смещает целевой индекс', () => {
    // [a, b, c] → a бросается в слот перед c (itemIndex=2, зафиксирован ДО
    // удаления a). Без компенсации a встал бы ЗА c.
    const zones = [zone([[item('a'), item('b'), item('c')]])]

    const next = applyGridDrop(zones, 'a', {
      zoneIndex: 0,
      rowIndex: 0,
      itemIndex: 2,
      newRow: false,
    })

    expect(ids(next)).toEqual([['b', 'a', 'c']])
  })

  it('дроп в конец строки: itemIndex за пределами клампится к длине', () => {
    // Бросок в пустоту правее последней плашки даёт индекс больше длины
    // строки после удаления источника — вставка в конец, не исключение.
    const zones = [zone([[item('a'), item('b')], [item('c')]])]

    const next = applyGridDrop(zones, 'c', {
      zoneIndex: 0,
      rowIndex: 0,
      itemIndex: 5,
      newRow: false,
    })

    // Опустевшая строка источника убрана, c встал в конец первой строки.
    expect(ids(next)).toEqual([['a', 'b', 'c']])
  })

  it('чистота: исходные зоны не мутируются', () => {
    const zones = [zone([[item('a'), item('b')]])]

    applyGridDrop(zones, 'a', {
      zoneIndex: 0,
      rowIndex: 0,
      itemIndex: 2,
      newRow: false,
    })

    expect(ids(zones)).toEqual([['a', 'b']])
  })
})

describe('findGridItem', () => {
  it('находит элемент с его зоной и строкой; чужой id — null', () => {
    const zones = [zone([[item('a')], [item('b')]])]

    const found = findGridItem(zones, 'b')

    expect(found?.item.nodeId).toBe('b')
    expect(found?.zone.zoneId).toBe('zone')
    expect(findGridItem(zones, 'ghost')).toBeNull()
  })
})
