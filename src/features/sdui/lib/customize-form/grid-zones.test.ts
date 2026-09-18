import { describe, expect, it } from 'vitest'

import type { ViewNode } from '../../types/view'
import type { NodeDecision } from './collect-customizable-nodes'
import {
  cloneZones,
  dropEmptyRows,
  extractGridZones,
  reflowZone,
  rowFreeUnits,
  zoneDecisions,
  type GridZone,
} from './grid-zones'

const item = (nodeId: string, homeZoneId = 'g', span = 12) => ({
  nodeId,
  label: nodeId,
  span,
  hidden: false,
  homeZoneId,
})

const node = (
  id: string,
  type: string,
  props?: Record<string, unknown>,
  children?: ViewNode[]
): ViewNode => ({ id, type: type as ViewNode['type'], props, children })

const field = (id: string, props?: Record<string, unknown>): ViewNode =>
  node(id, 'TEXT_FIELD', { label: id, ...props })

const grid24 = (id: string, children: ViewNode[]): ViewNode =>
  node(id, 'GRID', { columns: 24 }, children)

/** Строки зоны как списки id — компактная проверка раскладки. */
const rowIds = (zone: GridZone): string[][] =>
  zone.rows.map((row) => row.map((i) => i.nodeId))

const noHidden: ReadonlySet<string> = new Set()

describe('zoneDecisions: перенос между зонами (словарь v3)', () => {
  it('элемент в чужой зоне получает moveTo на неё, в родной — не получает', () => {
    const zones: GridZone[] = [
      {
        zoneId: 'grid.header',
        title: '',
        rows: [[item('a', 'grid.header')]],
      },
      {
        zoneId: 'group.podval',
        title: '',
        rows: [[item('b', 'grid.header'), item('c', 'group.podval')]],
      },
    ]
    const decisions = new Map<string, NodeDecision>()

    zoneDecisions(zones, decisions)

    expect(decisions.get('a')?.moveTo).toBeUndefined()
    expect(decisions.get('b')?.moveTo).toBe('group.podval')
    expect(decisions.get('c')?.moveTo).toBeUndefined()
  })
})

describe('extractGridZones: поиск зон в дереве', () => {
  it('пустой корень — пусто; легаси-GRID (columns≠24) зоной не становится', () => {
    expect(extractGridZones(null, noHidden)).toEqual([])

    const tree = node('page', 'PAGE', {}, [
      node('legacy', 'GRID', { columns: 2 }, [field('a')]),
      node('bare', 'GRID', {}, [field('b')]),
    ])
    expect(extractGridZones(tree, noHidden)).toEqual([])
  })

  it('зона в TAB берёт заголовок вкладки (title, фолбэк label), шапка — пустой', () => {
    const tree = node('page', 'PAGE', {}, [
      grid24('grid.header', [field('a')]),
      node('tabs', 'TABS', {}, [
        node('tab.1', 'TAB', { title: 'Основное' }, [
          grid24('grid.tab1', [field('b')]),
        ]),
        node('tab.2', 'TAB', { label: 'Прочее' }, [
          grid24('grid.tab2', [field('c')]),
        ]),
      ]),
    ])

    const zones = extractGridZones(tree, noHidden)

    expect(zones.map((z) => [z.zoneId, z.title])).toEqual([
      ['grid.header', ''],
      ['grid.tab1', 'Основное'],
      ['grid.tab2', 'Прочее'],
    ])
  })
})

describe('extractGridZones: перенос строк по 24-сетке', () => {
  it('переполнение суммы colSpan рвёт строку, как перенос текста', () => {
    const tree = grid24('g', [
      field('a', { colSpan: 12 }),
      field('b', { colSpan: 12 }),
      field('c', { colSpan: 12 }),
    ])

    const [zone] = extractGridZones(tree, noHidden)

    expect(rowIds(zone)).toEqual([['a', 'b'], ['c']])
  })

  it('newRow рвёт строку даже при свободном месте', () => {
    const tree = grid24('g', [
      field('a', { colSpan: 6 }),
      field('b', { colSpan: 6, newRow: true }),
    ])

    const [zone] = extractGridZones(tree, noHidden)

    expect(rowIds(zone)).toEqual([['a'], ['b']])
  })

  it('спейсер не попадает в модель, но его ширина двигает границу строки', () => {
    const tree = grid24('g', [
      field('a', { colSpan: 12 }),
      node('sp', 'SPACER', { colSpan: 12 }),
      field('b', { colSpan: 12 }),
    ])

    const [zone] = extractGridZones(tree, noHidden)

    // Спейсер добил первую строку до 24 — b уехал на вторую.
    expect(rowIds(zone)).toEqual([['a'], ['b']])
  })

  it('без colSpan (или с мусорным) элемент занимает всю строку; >24 клампится', () => {
    const tree = grid24('g', [
      field('a'),
      field('b', { colSpan: 0 }),
      field('c', { colSpan: 99 }),
    ])

    const [zone] = extractGridZones(tree, noHidden)

    expect(rowIds(zone)).toEqual([['a'], ['b'], ['c']])
    expect(zone.rows.flat().map((i) => i.span)).toEqual([24, 24, 24])
  })
})

describe('extractGridZones: скрытия и подписи', () => {
  it('скрытая сервером нода выпадает из модели, скрытая пользователем — остаётся пунктиром', () => {
    const tree = grid24('g', [
      field('a', { colSpan: 8 }),
      field('srv', { colSpan: 8, visible: false }),
      field('usr', { colSpan: 8, visible: false }),
    ])

    const [zone] = extractGridZones(tree, new Set(['usr']))

    expect(rowIds(zone)).toEqual([['a', 'usr']])
    expect(zone.rows[0][1].hidden).toBe(true)
  })

  it('поле без подписи получает сентинел «⋯», а не технический id', () => {
    const tree = grid24('g', [node('f.raw', 'TEXT_FIELD', { colSpan: 12 })])

    const [zone] = extractGridZones(tree, noHidden)

    expect(zone.rows[0][0].label).toBe('⋯')
    expect(zone.rows[0][0].homeZoneId).toBe('g')
  })
})

describe('reflowZone: каскадное перетекание', () => {
  it('вставка в полную строку выталкивает хвост в начало следующей', () => {
    const zone: GridZone = {
      zoneId: 'g',
      title: '',
      rows: [
        [item('a'), item('b'), item('x')],
        [item('c'), item('d', 'g', 6)],
      ],
    }

    reflowZone(zone)

    // x вытеснен и встал ПЕРЕД c (порядок потока сохранён); вторая строка
    // от этого тоже переполнилась — d каскадом уехал в новую третью.
    expect(rowIds(zone)).toEqual([['a', 'b'], ['x', 'c'], ['d']])
  })

  it('только-что вставленный элемент приоритетен: уезжает сосед, а не он', () => {
    const zone: GridZone = {
      zoneId: 'g',
      title: '',
      rows: [[item('a'), item('b'), item('dropped')]],
    }

    reflowZone(zone, 'dropped')

    expect(rowIds(zone)).toEqual([['a', 'dropped'], ['b']])
  })

  it('переполнение каскадит через несколько строк и создаёт новую в конце', () => {
    const zone: GridZone = {
      zoneId: 'g',
      title: '',
      rows: [
        [item('a'), item('b'), item('x')],
        [item('c'), item('d')],
      ],
    }

    reflowZone(zone, 'x')

    // b вытеснен во вторую строку, оттуда d — в новую третью.
    expect(rowIds(zone)).toEqual([['a', 'x'], ['b', 'c'], ['d']])
  })

  it('элемент шире остатка в одиночной строке не зацикливает перетекание', () => {
    const zone: GridZone = {
      zoneId: 'g',
      title: '',
      rows: [[item('wide', 'g', 24)]],
    }

    reflowZone(zone, 'wide')

    // Одинокий элемент не вытесняется (row.length > 1) — строка остаётся.
    expect(rowIds(zone)).toEqual([['wide']])
  })

  it('строки без переполнения не трогаются', () => {
    const zone: GridZone = {
      zoneId: 'g',
      title: '',
      rows: [[item('a', 'g', 6), item('b', 'g', 6)], [item('c', 'g', 24)]],
    }

    reflowZone(zone)

    expect(rowIds(zone)).toEqual([['a', 'b'], ['c']])
  })
})

describe('вспомогательные функции зон', () => {
  it('rowFreeUnits считает остаток строки, отрицательный при переполнении', () => {
    expect(rowFreeUnits([])).toBe(24)
    expect(rowFreeUnits([item('a'), item('b', 'g', 6)])).toBe(6)
    expect(rowFreeUnits([item('a', 'g', 24), item('b')])).toBe(-12)
  })

  it('cloneZones даёт независимую копию: мутация копии не трогает оригинал', () => {
    const original: GridZone[] = [
      { zoneId: 'g', title: '', rows: [[item('a')]] },
    ]

    const copy = cloneZones(original)
    copy[0].rows[0][0].span = 6
    copy[0].rows.push([item('b')])

    expect(original[0].rows[0][0].span).toBe(12)
    expect(original[0].rows).toHaveLength(1)
  })

  it('dropEmptyRows выбрасывает пустые строки после перестановок', () => {
    const zone: GridZone = {
      zoneId: 'g',
      title: '',
      rows: [[], [item('a')], []],
    }

    dropEmptyRows(zone)

    expect(rowIds(zone)).toEqual([['a']])
  })
})

describe('zoneDecisions: сериализация потока', () => {
  it('order сквозной по зоне, newRow только у первых элементов непервых строк', () => {
    const zone: GridZone = {
      zoneId: 'g',
      title: '',
      rows: [
        [item('a'), item('b')],
        [item('c', 'g', 6), item('d', 'g', 6)],
      ],
    }
    const decisions = new Map<string, NodeDecision>()

    zoneDecisions([zone], decisions)

    expect(decisions.get('a')).toMatchObject({ order: 0, newRow: false })
    expect(decisions.get('b')).toMatchObject({ order: 1, newRow: false })
    // newRow явный (false тоже пишется): иначе базовый newRow нормализатора
    // пережил бы перестановку.
    expect(decisions.get('c')).toMatchObject({
      order: 2,
      newRow: true,
      colSpan: 6,
    })
    expect(decisions.get('d')).toMatchObject({ order: 3, newRow: false })
  })

  it('скрытость элемента уходит в решение как hidden', () => {
    const zone: GridZone = {
      zoneId: 'g',
      title: '',
      rows: [[{ ...item('a'), hidden: true }]],
    }
    const decisions = new Map<string, NodeDecision>()

    zoneDecisions([zone], decisions)

    expect(decisions.get('a')?.hidden).toBe(true)
  })
})
