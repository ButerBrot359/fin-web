import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../types/view'
import { applyPatches } from '../lib/patch-applier'
import { NodeRenderer } from './node-renderer'

vi.mock('../lib/component-registry', () => ({
  getComponent: (type: string) =>
    type === 'UNREGISTERED'
      ? undefined
      : ({ node }: { node: ViewNode }) => (
          // Дети рисуются через сам NodeRenderer — так тест видит, что скрытый
          // контейнер не пускает рендер в поддерево.
          <div data-testid={node.id}>
            {node.children?.map((c) => (
              <NodeRenderer key={c.id} node={c} />
            ))}
          </div>
        ),
}))

const node = (
  id: string,
  props?: Record<string, unknown>,
  children?: ViewNode[]
): ViewNode => ({ id, type: 'VSTACK', props, children }) as ViewNode

// globals в vitest.config выключены — авточистки DOM между тестами нет.
afterEach(cleanup)

describe('NodeRenderer / видимость узла', () => {
  it('visible === false в дереве → узел не рендерится вместе с поддеревом', () => {
    const tree = node('group.avans', { label: 'Аванс:', visible: false }, [
      node('field.summaAvansa', { visible: true }),
    ])
    const { queryByTestId } = render(<NodeRenderer node={tree} />)
    expect(queryByTestId('group.avans')).toBeNull()
    expect(queryByTestId('field.summaAvansa')).toBeNull()
  })

  it('visible === false у кнопки → кнопка не рендерится', () => {
    const btn = { id: 'btn.swift', type: 'BUTTON', props: { visible: false } }
    const { queryByTestId } = render(<NodeRenderer node={btn as ViewNode} />)
    expect(queryByTestId('btn.swift')).toBeNull()
  })

  it('пропа visible нет → узел видим', () => {
    const { getByTestId } = render(<NodeRenderer node={node('group.avans')} />)
    expect(getByTestId('group.avans')).toBeTruthy()
  })

  it('visible === true → узел видим', () => {
    const { getByTestId } = render(
      <NodeRenderer node={node('group.avans', { visible: true })} />
    )
    expect(getByTestId('group.avans')).toBeTruthy()
  })

  it('рантайм-патч setProp visible=false гасит контейнер и его поддерево', () => {
    const tree = node('page', {}, [
      node('group.avans', { label: 'Аванс:' }, [node('btn.raschetAvansa')]),
    ])
    const { getByTestId, queryByTestId, rerender } = render(
      <NodeRenderer node={tree} />
    )
    expect(getByTestId('group.avans')).toBeTruthy()

    const patched = applyPatches(tree, [
      { op: 'setProp', nodeId: 'group.avans', key: 'visible', value: false },
    ])
    rerender(<NodeRenderer node={patched} />)

    expect(queryByTestId('group.avans')).toBeNull()
    expect(queryByTestId('btn.raschetAvansa')).toBeNull()
    expect(getByTestId('page')).toBeTruthy()
  })

  it('неизвестный тип со скрытым visible тоже не рисует заглушку', () => {
    const unknown = { id: 'x', type: 'UNREGISTERED', props: { visible: false } }
    const { container } = render(<NodeRenderer node={unknown as ViewNode} />)
    expect(container.textContent).toBe('')
  })
})
