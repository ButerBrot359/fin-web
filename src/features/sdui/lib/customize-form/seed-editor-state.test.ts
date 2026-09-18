import { describe, expect, it } from 'vitest'

import type { ViewNode } from '../../types/view'
import { seedEditorState } from './seed-editor-state'

const node = (
  id: string,
  type: string,
  props?: Record<string, unknown>,
  children?: ViewNode[]
): ViewNode => ({ id, type: type as ViewNode['type'], props, children })

/** Секционная форма: шапка-зона 24, блок вкладок, блок итогов. */
const sectionedTree = node('page', 'PAGE', {}, [
  node('body', 'VSTACK', {}, [
    node('grid.header', 'GRID', { columns: 24 }, [
      node('field.org', 'TEXT_FIELD', { label: 'Организация', colSpan: 12 }),
      node('field.date', 'DATE_FIELD', { label: 'Дата', colSpan: 12 }),
    ]),
    node('tabs', 'TABS', {}, [
      node('tab1', 'TAB', { title: 'Основное' }, [
        node('grid.tab1', 'GRID', { columns: 24 }, [
          node('field.sum', 'NUMBER_FIELD', { label: 'Сумма', colSpan: 12 }),
        ]),
      ]),
    ]),
    node('footer', 'VSTACK', { label: 'Итого' }),
  ]),
])

/** Легаси-форма без нормализованных зон. */
const legacyTree = node('page', 'PAGE', {}, [
  node('stack', 'VSTACK', {}, [
    node('field.org', 'REFERENCE_FIELD', { label: 'Организация' }),
    node('field.comment', 'TEXT_AREA', {
      label: 'Комментарий',
      visible: false,
    }),
  ]),
])

describe('seedEditorState: секционная форма', () => {
  it('строит секции, легаси-структуры пустые', () => {
    const seed = seedEditorState(sectionedTree, [])

    expect(seed.sections.map((s) => s.nodeId)).toEqual([
      'grid.header',
      'tabs',
      'footer',
    ])
    expect(seed.rows).toEqual([])
    expect(seed.hidden.size).toBe(0)
    expect(seed.widths.size).toBe(0)
  })

  it('скрытое патчем поле остаётся в зоне с пунктиром (hidden)', () => {
    const seed = seedEditorState(sectionedTree, [
      { nodeId: 'field.date', props: { visible: false } },
    ])

    const headerZone = seed.sections[0].zone
    const date = headerZone?.rows.flat().find((i) => i.nodeId === 'field.date')
    expect(date?.hidden).toBe(true)
  })

  it('переопределения подписей из патча попадают в labels', () => {
    const seed = seedEditorState(sectionedTree, [
      { nodeId: 'field.org', props: { label: 'Моя организация' } },
      { nodeId: 'field.sum', props: { colSpan: 6 } },
    ])

    expect(seed.labels.get('field.org')).toBe('Моя организация')
    expect(seed.labels.has('field.sum')).toBe(false)
  })
})

describe('seedEditorState: легаси-форма без секций', () => {
  it('собирает строки, скрытые патчем — в hidden, ширины — в widths', () => {
    const seed = seedEditorState(legacyTree, [
      { nodeId: 'field.comment', props: { visible: false } },
    ])

    expect(seed.sections).toEqual([])
    expect(seed.rows.map((r) => r.nodeId)).toEqual([
      'field.org',
      'field.comment',
    ])
    expect(seed.hidden.has('field.comment')).toBe(true)
    expect(seed.hidden.has('field.org')).toBe(false)
    expect(seed.widths.get('field.org')).toBeUndefined()
    expect(seed.widths.has('field.org')).toBe(true)
  })

  it('пустое дерево — пустое состояние', () => {
    const seed = seedEditorState(null, [])

    expect(seed.sections).toEqual([])
    expect(seed.rows).toEqual([])
    expect(seed.labels.size).toBe(0)
  })
})
