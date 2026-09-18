import { describe, expect, it } from 'vitest'

import type { ViewNode } from '../../types/view'
import { collectTableColumns } from './collect-table-columns'

const node = (
  id: string,
  type: string,
  props?: Record<string, unknown>,
  children?: ViewNode[]
): ViewNode => ({ id, type: type as ViewNode['type'], props, children })

const column = (id: string, props?: Record<string, unknown>): ViewNode =>
  node(id, 'TABLE_COLUMN', { label: id, ...props })

describe('collectTableColumns', () => {
  it('пустой корень — пустая карта', () => {
    expect(collectTableColumns(null, new Set()).size).toBe(0)
  })

  it('колонки группируются по таблицам, вложенным в разные ветки', () => {
    const tree = node('page', 'PAGE', {}, [
      node('tab1', 'TAB', {}, [
        node('t1', 'TABLE', {}, [column('c1'), column('c2')]),
      ]),
      node('t2', 'TABLE', {}, [column('c3')]),
    ])

    const groups = collectTableColumns(tree, new Set())

    expect([...groups.keys()]).toEqual(['t1', 't2'])
    expect(groups.get('t1')?.map((c) => c.nodeId)).toEqual(['c1', 'c2'])
    expect(groups.get('t2')?.map((c) => c.nodeId)).toEqual(['c3'])
  })

  it('безымянные, пустые подписи и не-колонки отфильтровываются', () => {
    const tree = node('t', 'TABLE', {}, [
      column('ok'),
      node('noLabel', 'TABLE_COLUMN', {}),
      node('blank', 'TABLE_COLUMN', { label: '   ' }),
      node('stray', 'TEXT_FIELD', { label: 'Не колонка' }),
    ])

    const groups = collectTableColumns(tree, new Set())

    expect(groups.get('t')?.map((c) => c.nodeId)).toEqual(['ok'])
  })

  it('скрытая сервером колонка выпадает, скрытая пользователем — hidden:true', () => {
    const tree = node('t', 'TABLE', {}, [
      column('visible'),
      column('srv', { visible: false }),
      column('usr', { visible: false }),
    ])

    const groups = collectTableColumns(tree, new Set(['usr']))

    expect(groups.get('t')).toEqual([
      { nodeId: 'visible', label: 'visible', hidden: false },
      { nodeId: 'usr', label: 'usr', hidden: true },
    ])
  })

  it('таблица без пригодных колонок в карту не попадает', () => {
    const tree = node('t', 'TABLE', {}, [node('noLabel', 'TABLE_COLUMN', {})])

    expect(collectTableColumns(tree, new Set()).size).toBe(0)
  })
})
