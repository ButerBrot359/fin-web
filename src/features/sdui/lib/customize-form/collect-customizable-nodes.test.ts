import { describe, expect, it } from 'vitest'

import type { ViewNode } from '../../types/view'
import {
  buildPatchFromDecisions,
  collectCustomizableNodes,
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
  it('собирает поля с подписью, пропуская кнопки и безымянные ноды', () => {
    const nodes = collectCustomizableNodes(tree, [])

    expect(nodes.map((n) => n.nodeId)).toEqual(['field.org', 'field.comment'])
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
  it('скрытие добавляет visible:false, чужие пропы записи сохраняются', () => {
    const patch = buildPatchFromDecisions(
      [{ nodeId: 'panel', props: { width: 900 } }],
      new Set(['panel', 'field.comment'])
    )

    expect(patch).toContainEqual({
      nodeId: 'panel',
      props: { width: 900, visible: false },
    })
    expect(patch).toContainEqual({
      nodeId: 'field.comment',
      props: { visible: false },
    })
  })

  it('показ обратно убирает visible, пустая запись выбрасывается', () => {
    const patch = buildPatchFromDecisions(
      [
        { nodeId: 'field.comment', props: { visible: false } },
        { nodeId: 'panel', props: { visible: false, width: 900 } },
      ],
      new Set()
    )

    expect(patch).toEqual([{ nodeId: 'panel', props: { width: 900 } }])
  })
})
