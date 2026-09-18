import { describe, expect, it } from 'vitest'

import type { ViewNode } from '../../types/view'
import { buildPreviewModel, type PreviewNode } from './build-preview-model'
import type { CustomizableNode } from './collect-customizable-nodes'

const node = (
  id: string,
  type: string,
  props?: Record<string, unknown>,
  children?: ViewNode[]
): ViewNode => ({ id, type: type as ViewNode['type'], props, children })

const field = (id: string, props?: Record<string, unknown>): ViewNode =>
  node(id, 'TEXT_FIELD', { label: id, ...props })

/** Ряд диалога: важны только nodeId, hiddenByUser и позиция в массиве. */
const row = (nodeId: string, hiddenByUser = false): CustomizableNode => ({
  nodeId,
  label: nodeId,
  visible: !hiddenByUser,
  hiddenByUser,
  parentId: 'stack',
  childIndex: 0,
  isField: true,
  width: undefined,
})

const leafIds = (parent: PreviewNode | null): string[] =>
  (parent?.children ?? []).map((c) => c.nodeId)

describe('buildPreviewModel: базовая схема', () => {
  it('пустой корень — null; контейнер без видимых детей схлопывается в null', () => {
    expect(buildPreviewModel(null, [])).toBeNull()
    expect(
      buildPreviewModel(
        node('page', 'PAGE', {}, [node('toolbar', 'TOOLBAR', {})]),
        []
      )
    ).toBeNull()
  })

  it('поля — leaf, таблица — широкая, служебный хром и безымянные — мимо', () => {
    const tree = node('page', 'PAGE', {}, [
      field('f.org'),
      node('tbl', 'TABLE', { label: 'Товары' }),
      node('btn', 'BUTTON', { label: 'Записать' }),
      node('f.raw', 'TEXT_FIELD', {}),
    ])

    const model = buildPreviewModel(tree, [row('f.org')])

    expect(model?.kind).toBe('column')
    expect(leafIds(model)).toEqual(['f.org', 'tbl'])
    expect(model?.children[0]).toMatchObject({
      kind: 'leaf',
      editable: true,
      wide: false,
    })
    expect(model?.children[1]).toMatchObject({ editable: false, wide: true })
  })

  it('TABS — одна широкая плашка с заголовками вкладок (title, фолбэк label)', () => {
    const tree = node('page', 'PAGE', {}, [
      field('f'),
      node('tabs', 'TABS', {}, [
        node('t1', 'TAB', { title: 'Основное' }),
        node('t2', 'TAB', { label: 'Прочее' }),
        node('t3', 'TAB', {}),
      ]),
    ])

    const model = buildPreviewModel(tree, [])
    const tabs = model?.children.find((c) => c.nodeId === 'tabs')

    expect(tabs).toMatchObject({
      kind: 'tabs',
      wide: true,
      label: 'Основное · Прочее',
    })
  })

  it('скрытая сервером нода выпадает, editable-нода остаётся даже с visible:false', () => {
    const tree = node('page', 'PAGE', {}, [
      field('visible'),
      field('srv', { visible: false }),
      field('usr', { visible: false }),
    ])

    // usr скрыт патчем пользователя (hiddenByUser) — остаётся в превью.
    const model = buildPreviewModel(tree, [row('visible'), row('usr', true)])

    expect(leafIds(model)).toEqual(['visible', 'usr'])
  })
})

describe('buildPreviewModel: слотовая пересортировка editable-детей', () => {
  it('editable-дети встают в порядке диалога, не-editable держат свои слоты', () => {
    const tree = node('page', 'PAGE', {}, [
      node('grid', 'GRID', {}, [
        field('a'),
        field('static'), // не в arrangedRows — слот 1 неприкосновенен
        field('b'),
      ]),
    ])

    // Диалог переставил: b раньше a.
    const model = buildPreviewModel(tree, [row('b'), row('a')])

    expect(leafIds(model?.children[0] ?? null)).toEqual(['b', 'static', 'a'])
  })

  it('без перестановок порядок дерева сохраняется', () => {
    const tree = node('page', 'PAGE', {}, [
      node('grid', 'HSTACK', {}, [field('a'), field('b'), field('c')]),
    ])

    const model = buildPreviewModel(tree, [row('a'), row('b'), row('c')])

    expect(leafIds(model?.children[0] ?? null)).toEqual(['a', 'b', 'c'])
    expect(model?.children[0].kind).toBe('row')
  })

  it('пересортировка живёт в границах группы: чужие родители не смешиваются', () => {
    const tree = node('page', 'PAGE', {}, [
      node('g1', 'GRID', {}, [field('a'), field('b')]),
      node('g2', 'GRID', {}, [field('c'), field('d')]),
    ])

    // Глобальный порядок диалога: d, a, c, b — внутри групп это [a,b]→[a,b]?
    // Нет: в g1 editable [a,b] сортируются по индексам (a=1, b=3) → [a,b];
    // в g2 (d=0, c=2) → [d,c].
    const model = buildPreviewModel(tree, [
      row('d'),
      row('a'),
      row('c'),
      row('b'),
    ])

    expect(leafIds(model?.children[0] ?? null)).toEqual(['a', 'b'])
    expect(leafIds(model?.children[1] ?? null)).toEqual(['d', 'c'])
  })
})
