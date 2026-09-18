import { describe, expect, it } from 'vitest'

import type { GridItem, GridZone } from './grid-zones'
import type { PageSection } from './page-sections'
import {
  moveAcrossZones,
  moveSection,
  replaceZone,
  toggleSection,
  toggleTab,
  toggleTabColumn,
  toggleZoneItem,
} from './section-mutations'

const item = (nodeId: string, homeZoneId: string, span = 8): GridItem => ({
  nodeId,
  label: nodeId,
  span,
  hidden: false,
  homeZoneId,
})

/** Страница: шапка-зона, блок вкладок (полевая вкладка со своей зоной), блок. */
const makeSections = (): PageSection[] => [
  {
    nodeId: 'header',
    kind: 'zone',
    label: 'Шапка',
    hidable: false,
    hidden: false,
    zone: {
      zoneId: 'zone.header',
      title: '',
      rows: [[item('a', 'zone.header'), item('b', 'zone.header')]],
    },
  },
  {
    nodeId: 'tabs',
    kind: 'tabs',
    label: 'Вкладки',
    hidable: true,
    hidden: false,
    tabs: [
      {
        nodeId: 'tab1',
        title: 'Основное',
        hidden: false,
        zone: {
          zoneId: 'zone.tab1',
          title: 'Основное',
          rows: [[item('c', 'zone.tab1')]],
        },
      },
      {
        nodeId: 'tab2',
        title: 'Таблица',
        hidden: false,
        tableColumns: [{ nodeId: 'col1', label: 'Сумма', hidden: false }],
      },
    ],
  },
  {
    nodeId: 'footer',
    kind: 'block',
    label: 'Итого',
    hidable: true,
    hidden: false,
  },
]

describe('moveSection', () => {
  it('меняет секцию местами с соседом по направлению', () => {
    const next = moveSection(makeSections(), 0, 1)

    expect(next.map((s) => s.nodeId)).toEqual(['tabs', 'header', 'footer'])
  })

  it('выход за края оставляет порядок без изменений', () => {
    expect(moveSection(makeSections(), 0, -1).map((s) => s.nodeId)).toEqual([
      'header',
      'tabs',
      'footer',
    ])
    expect(moveSection(makeSections(), 2, 1).map((s) => s.nodeId)).toEqual([
      'header',
      'tabs',
      'footer',
    ])
  })

  it('чистота: исходные секции не мутируются', () => {
    const sections = makeSections()

    moveSection(sections, 0, 1)

    expect(sections.map((s) => s.nodeId)).toEqual(['header', 'tabs', 'footer'])
  })
})

describe('moveAcrossZones', () => {
  it('переносит элемент из шапки в зону вкладки; ширина сохраняется', () => {
    const next = moveAcrossZones(makeSections(), 'a', {
      zoneId: 'zone.tab1',
      rowIndex: 0,
      itemIndex: 1,
      newRow: false,
    })

    const tabZone = next[1].tabs?.[0].zone
    expect(tabZone?.rows[0].map((i) => i.nodeId)).toEqual(['c', 'a'])
    expect(tabZone?.rows[0][1].span).toBe(8)
    expect(next[0].zone?.rows[0].map((i) => i.nodeId)).toEqual(['b'])
  })

  it('splice-края: itemIndex за пределами клампится к концу строки', () => {
    const next = moveAcrossZones(makeSections(), 'a', {
      zoneId: 'zone.tab1',
      rowIndex: 0,
      itemIndex: 99,
      newRow: false,
    })

    expect(next[1].tabs?.[0].zone?.rows[0].map((i) => i.nodeId)).toEqual([
      'c',
      'a',
    ])
  })

  it('splice-края: несуществующая строка цели даёт новую строку в конце', () => {
    const next = moveAcrossZones(makeSections(), 'a', {
      zoneId: 'zone.tab1',
      rowIndex: 5,
      itemIndex: 0,
      newRow: false,
    })

    const tabZone = next[1].tabs?.[0].zone
    expect(tabZone?.rows.map((r) => r.map((i) => i.nodeId))).toEqual([
      ['c'],
      ['a'],
    ])
  })

  it('newRow: элемент встаёт отдельной строкой, rowIndex клампится', () => {
    const next = moveAcrossZones(makeSections(), 'b', {
      zoneId: 'zone.tab1',
      rowIndex: 9,
      itemIndex: 0,
      newRow: true,
    })

    expect(
      next[1].tabs?.[0].zone?.rows.map((r) => r.map((i) => i.nodeId))
    ).toEqual([['c'], ['b']])
  })

  it('опустевшая строка-источник убирается из исходной зоны', () => {
    const next = moveAcrossZones(makeSections(), 'c', {
      zoneId: 'zone.header',
      rowIndex: 0,
      itemIndex: 0,
      newRow: false,
    })

    expect(next[1].tabs?.[0].zone?.rows).toEqual([])
    expect(next[0].zone?.rows[0].map((i) => i.nodeId)).toEqual(['c', 'a', 'b'])
  })
})

describe('toggle-мутации', () => {
  it('toggleZoneItem переключает элемент и в зоне секции, и в зоне вкладки', () => {
    const inHeader = toggleZoneItem(makeSections(), 'a')
    expect(inHeader[0].zone?.rows[0][0].hidden).toBe(true)

    const inTab = toggleZoneItem(makeSections(), 'c')
    expect(inTab[1].tabs?.[0].zone?.rows[0][0].hidden).toBe(true)

    const back = toggleZoneItem(inTab, 'c')
    expect(back[1].tabs?.[0].zone?.rows[0][0].hidden).toBe(false)
  })

  it('toggleSection / toggleTab / toggleTabColumn переключают видимость', () => {
    expect(toggleSection(makeSections(), 2)[2].hidden).toBe(true)
    expect(toggleTab(makeSections(), 1, 'tab2')[1].tabs?.[1].hidden).toBe(true)
    expect(
      toggleTabColumn(makeSections(), 1, 'tab2', 'col1')[1].tabs?.[1]
        .tableColumns?.[0].hidden
    ).toBe(true)
  })

  it('чистота: исходные секции не мутируются toggle-ами', () => {
    const sections = makeSections()

    toggleZoneItem(sections, 'a')
    toggleSection(sections, 2)

    expect(sections[0].zone?.rows[0][0].hidden).toBe(false)
    expect(sections[2].hidden).toBe(false)
  })
})

describe('replaceZone', () => {
  it('заменяет зону по id в секции и во вкладке', () => {
    const newZone: GridZone = {
      zoneId: 'zone.tab1',
      title: 'Основное',
      rows: [[item('x', 'zone.tab1')]],
    }

    const next = replaceZone(makeSections(), 'zone.tab1', newZone)

    expect(next[1].tabs?.[0].zone?.rows[0][0].nodeId).toBe('x')
    expect(next[0].zone?.rows[0].map((i) => i.nodeId)).toEqual(['a', 'b'])
  })
})
