import { describe, expect, it } from 'vitest'

import type { ViewNode } from '../../types/view'
import {
  assignOrders,
  buildPatchFromDecisions,
  collectCustomizableNodes,
  type NodeDecision,
} from './collect-customizable-nodes'

const node = (
  id: string,
  type: string,
  props?: Record<string, unknown>,
  children?: ViewNode[]
): ViewNode => ({ id, type: type as ViewNode['type'], props, children })

const tree = node('page', 'PAGE', {}, [
  node('stack', 'VSTACK', {}, [
    node('field.org', 'REFERENCE_FIELD', { label: 'Организация' }),
    node('field.comment', 'TEXT_AREA', { label: 'Комментарий' }),
    node('btn.save', 'BUTTON', { label: 'Записать' }),
    node('field.secret', 'TEXT_FIELD', { label: 'Секрет', visible: false }),
    node('field.noLabel', 'TEXT_FIELD', {}),
  ]),
])

describe('collectCustomizableNodes', () => {
  it('собирает поля с подписью, родителем и индексом; кнопки и безымянные — мимо', () => {
    const nodes = collectCustomizableNodes(tree, [])

    expect(nodes.map((n) => n.nodeId)).toEqual(['field.org', 'field.comment'])
    expect(nodes[0]).toMatchObject({
      parentId: 'stack',
      childIndex: 0,
      isField: true,
      width: undefined,
    })
    expect(nodes[1].childIndex).toBe(1)
  })

  it('скрытая сервером нода не предлагается — чужое скрытие не раскрыть', () => {
    const nodes = collectCustomizableNodes(tree, [])

    expect(nodes.find((n) => n.nodeId === 'field.secret')).toBeUndefined()
  })

  it('скрытая патчем пользователя — в списке с выключенной галочкой', () => {
    const nodes = collectCustomizableNodes(tree, [
      { nodeId: 'field.secret', props: { visible: false } },
    ])

    const secret = nodes.find((n) => n.nodeId === 'field.secret')
    expect(secret).toMatchObject({ visible: false, hiddenByUser: true })
  })

  it('пустое дерево — пустой список', () => {
    expect(collectCustomizableNodes(null, [])).toEqual([])
  })
})

describe('buildPatchFromDecisions', () => {
  it('скрытие и ширина попадают в запись, чужие пропы сохраняются', () => {
    const patch = buildPatchFromDecisions(
      [{ nodeId: 'panel', props: { gap: 4 } }],
      new Map<string, NodeDecision>([
        ['panel', { hidden: true, width: 300 }],
        ['field.comment', { hidden: true }],
      ])
    )

    expect(patch).toContainEqual({
      nodeId: 'panel',
      props: { gap: 4, visible: false, width: 300 },
    })
    expect(patch).toContainEqual({
      nodeId: 'field.comment',
      props: { visible: false },
    })
  })

  it('показ обратно и сброс ширины чистят пропы; пустая запись выбрасывается', () => {
    const patch = buildPatchFromDecisions(
      [
        { nodeId: 'field.comment', props: { visible: false, width: 200 } },
        { nodeId: 'panel', props: { visible: false, gap: 2 } },
      ],
      new Map<string, NodeDecision>([
        ['field.comment', { hidden: false }],
        ['panel', { hidden: false }],
      ])
    )

    expect(patch).toEqual([{ nodeId: 'panel', props: { gap: 2 } }])
  })

  it('order нетронутого родителя переживает сохранение', () => {
    const patch = buildPatchFromDecisions(
      [{ nodeId: 'field.org', props: { order: 3 } }],
      new Map<string, NodeDecision>([['field.org', { hidden: false }]])
    )

    expect(patch).toEqual([{ nodeId: 'field.org', props: { order: 3 } }])
  })
})

describe('assignOrders', () => {
  it('переставленный родитель получает order по исходным слотам группы', () => {
    const rows = collectCustomizableNodes(tree, [])
    const arranged = [rows[1], rows[0]]
    const decisions = new Map<string, NodeDecision>(
      rows.map((r) => [r.nodeId, { hidden: false }])
    )

    assignOrders(rows, arranged, decisions)

    expect(decisions.get('field.comment')?.order).toBe(0)
    expect(decisions.get('field.org')?.order).toBe(1)
  })

  it('нетронутый родитель не получает order вовсе', () => {
    const rows = collectCustomizableNodes(tree, [])
    const decisions = new Map<string, NodeDecision>(
      rows.map((r) => [r.nodeId, { hidden: false }])
    )

    assignOrders(rows, rows, decisions)

    expect(decisions.get('field.org')?.order).toBeUndefined()
    expect(decisions.get('field.comment')?.order).toBeUndefined()
  })
})
