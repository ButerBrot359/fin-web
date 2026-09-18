import { describe, expect, it } from 'vitest'

import type { ViewNode } from '../../types/view'
import type { NodeDecision } from './collect-customizable-nodes'
import { collectTableColumns } from './collect-table-columns'
import { extractGridZones, type GridZone } from './grid-zones'
import { buildPageSections, sectionDecisions } from './page-sections'

const node = (
  id: string,
  type: string,
  props?: Record<string, unknown>,
  children?: ViewNode[]
): ViewNode => ({ id, type: type as ViewNode['type'], props, children })

const field = (id: string, label = id): ViewNode =>
  node(id, 'TEXT_FIELD', { label, colSpan: 12 })

const grid24 = (id: string, children: ViewNode[]): ViewNode =>
  node(id, 'GRID', { columns: 24 }, children)

/**
 * Типовая страница v5: шапка-зона + блок вкладок (полевая и табличная) +
 * блок итогов. Тело — VSTACK, вложенный в PAGE (findBody должен докопаться).
 */
const makePage = (): ViewNode =>
  node('page', 'PAGE', {}, [
    node('toolbar', 'TOOLBAR', {}, [
      node('btn', 'BUTTON', { label: 'Записать' }),
    ]),
    node('body', 'VSTACK', {}, [
      grid24('grid.header', [
        field('f.org', 'Организация'),
        field('f.date', 'Дата'),
      ]),
      node('tabs', 'TABS', {}, [
        node('tab.fields', 'TAB', { title: 'Основное' }, [
          grid24('grid.tab', [field('f.comment', 'Комментарий')]),
        ]),
        node('tab.table', 'TAB', { label: 'Товары' }, [
          node('tbl', 'TABLE', {}, [
            node('col.name', 'TABLE_COLUMN', { label: 'Наименование' }),
            node('col.qty', 'TABLE_COLUMN', { label: 'Кол-во' }),
          ]),
        ]),
      ]),
      node('totals', 'GROUP', {}, [
        node('lbl.sum', 'LABEL', { label: 'Итого' }),
      ]),
    ]),
  ])

/** Собирает входы buildPageSections так же, как это делает диалог. */
const build = (root: ViewNode, hidden: ReadonlySet<string> = new Set()) => {
  const zones = extractGridZones(root, hidden)
  const zonesById = new Map(zones.map((z) => [z.zoneId, z]))
  const tableColumns = collectTableColumns(root, hidden)
  return buildPageSections(root, zonesById, hidden, tableColumns)
}

describe('buildPageSections: разбор страницы на секции', () => {
  it('шапка-зона, блок вкладок и прочий блок идут секциями в порядке тела', () => {
    const sections = build(makePage())

    expect(sections.map((s) => [s.nodeId, s.kind])).toEqual([
      ['grid.header', 'zone'],
      ['tabs', 'tabs'],
      ['totals', 'block'],
    ])
    // Зоны скрываются пополево, блоки — целиком.
    expect(sections.map((s) => s.hidable)).toEqual([false, true, true])
  })

  it('вкладки несут свою начинку: полевая — зону, табличная — колонки', () => {
    const sections = build(makePage())
    const tabs = sections[1].tabs ?? []

    expect(tabs.map((t) => [t.nodeId, t.title])).toEqual([
      ['tab.fields', 'Основное'], // title
      ['tab.table', 'Товары'], // фолбэк label
    ])
    expect(tabs[0].zone?.zoneId).toBe('grid.tab')
    expect(tabs[0].tableColumns).toBeUndefined()
    expect(tabs[1].zone).toBeUndefined()
    expect(tabs[1].tableColumns?.map((c) => c.nodeId)).toEqual([
      'col.name',
      'col.qty',
    ])
  })

  it('подписи секций: зона — первые поля, tabs — заголовки вкладок, блок — вложенные label', () => {
    const sections = build(makePage())

    expect(sections[0].label).toBe('Организация, Дата')
    expect(sections[1].label).toBe('Основное · Товары')
    expect(sections[2].label).toBe('Итого')
  })

  it('скрытая сервером секция выпадает, скрытая пользователем остаётся с hidden', () => {
    const page = makePage()
    const body = page.children![1]
    body.children![2].props = { visible: false } // totals скрыт сервером
    const sections = build(page, new Set(['tabs']))

    expect(sections.map((s) => s.nodeId)).toEqual(['grid.header', 'tabs'])
    expect(sections.find((s) => s.nodeId === 'tabs')?.hidden).toBe(true)
  })

  it('вкладка: скрытая сервером выпадает, скрытая пользователем — пунктиром', () => {
    const page = makePage()
    const tabs = page.children![1].children![1]
    tabs.children![1].props = {
      ...tabs.children![1].props,
      visible: false,
    } // tab.table скрыт сервером
    const sections = build(page, new Set(['tab.fields']))

    const tabInfos = sections[1].tabs ?? []
    expect(tabInfos.map((t) => t.nodeId)).toEqual(['tab.fields'])
    expect(tabInfos[0].hidden).toBe(true)
  })

  it('вкладка без title и label получает сентинел «⋯»', () => {
    const page = makePage()
    const tabs = page.children![1].children![1]
    tabs.children![0].props = {} // сносим title
    const sections = build(page)

    expect(sections[1].tabs?.[0].title).toBe('⋯')
  })

  it('безымянный блок без вложенных подписей получает сентинел «⋯»', () => {
    const page = node('page', 'PAGE', {}, [
      node('body', 'VSTACK', {}, [
        grid24('g', [field('f')]),
        node('mystery', 'GROUP', {}, [node('sep', 'SEPARATOR', {})]),
      ]),
    ])

    const sections = build(page)

    expect(sections[1].label).toBe('⋯')
  })

  it('единственная секция — пустой список: диалог падает на легаси-режим', () => {
    const page = node('page', 'PAGE', {}, [
      node('body', 'VSTACK', {}, [grid24('g', [field('f')])]),
    ])

    expect(build(page)).toEqual([])
  })

  it('форма без тела (нет зон/TABS/TABLE) — пустой список', () => {
    const page = node('page', 'PAGE', {}, [
      node('stack', 'VSTACK', {}, [field('f')]),
    ])

    expect(build(page)).toEqual([])
    expect(build(node('empty', 'PAGE', {}, []))).toEqual([])
  })

  it('поиск тела не заходит в TOOLBAR (кнопочные стеки — не тело)', () => {
    // TABS внутри тулбара не должен объявить тулбар телом страницы.
    const page = node('page', 'PAGE', {}, [
      node('toolbar', 'TOOLBAR', {}, [
        node('fake', 'TABS', {}, [node('t', 'TAB', { title: 'x' })]),
      ]),
      node('body', 'VSTACK', {}, [
        grid24('g', [field('f')]),
        node('totals', 'GROUP', {}, [node('l', 'LABEL', { label: 'Итого' })]),
      ]),
    ])

    const sections = build(page)

    expect(sections.map((s) => s.nodeId)).toEqual(['g', 'totals'])
  })
})

describe('sectionDecisions: сериализация модели v5 в решения', () => {
  it('секции получают сквозной order; hidden пишется только скрываемым', () => {
    const sections = build(makePage())
    sections[2].hidden = true
    const decisions = new Map<string, NodeDecision>()

    sectionDecisions(sections, decisions)

    expect(decisions.get('grid.header')).toMatchObject({
      order: 0,
      hidden: false,
    })
    expect(decisions.get('tabs')).toMatchObject({ order: 1, hidden: false })
    expect(decisions.get('totals')).toMatchObject({ order: 2, hidden: true })
  })

  it('зона-секция с hidden не эмитит скрытие: зоны нескрываемы (hidable=false)', () => {
    const sections = build(makePage())
    sections[0].hidden = true // зона могла попасть в hiddenByUser старым патчем
    const decisions = new Map<string, NodeDecision>()

    sectionDecisions(sections, decisions)

    expect(decisions.get('grid.header')?.hidden).toBe(false)
  })

  it('вкладки, их зоны и колонки таблиц получают свои решения', () => {
    const sections = build(makePage())
    const tabs = sections[1].tabs!
    tabs[0].hidden = true
    tabs[1].tableColumns![1].hidden = true
    const decisions = new Map<string, NodeDecision>()

    sectionDecisions(sections, decisions)

    expect(decisions.get('tab.fields')).toEqual({ hidden: true })
    expect(decisions.get('tab.table')).toEqual({ hidden: false })
    // Поле из зоны вкладки прошло через zoneDecisions.
    expect(decisions.get('f.comment')).toMatchObject({
      order: 0,
      colSpan: 12,
      newRow: false,
    })
    expect(decisions.get('col.name')).toEqual({ hidden: false })
    expect(decisions.get('col.qty')).toEqual({ hidden: true })
  })

  it('зона-секция сериализует свои поля потоком (order/colSpan/newRow)', () => {
    const sections = build(makePage())
    const decisions = new Map<string, NodeDecision>()

    sectionDecisions(sections, decisions)

    expect(decisions.get('f.org')).toMatchObject({ order: 0, newRow: false })
    expect(decisions.get('f.date')).toMatchObject({ order: 1, newRow: false })
  })
})

describe('buildPageSections: зона против решений редактора', () => {
  it('секция-зона отдаёт ту же ссылку GridZone, что лежит в zonesById (мутации редактора видны)', () => {
    const root = makePage()
    const zones = extractGridZones(root, new Set())
    const zonesById = new Map<string, GridZone>(zones.map((z) => [z.zoneId, z]))
    const sections = buildPageSections(
      root,
      zonesById,
      new Set(),
      collectTableColumns(root, new Set())
    )

    expect(sections[0].zone).toBe(zonesById.get('grid.header'))
  })
})
