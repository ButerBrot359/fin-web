import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useValidationReportStore } from '@/entities/validation-report'

import type { ViewNode } from '../types/view'
import { applyPatches } from '../lib/patch-applier'
import { NodeRenderer } from './node-renderer'

const { StubNode } = vi.hoisted(() => ({
  StubNode: ({ node }: { node: ViewNode }) => (
    // Дети рисуются через сам NodeRenderer — так тест видит, что скрытый
    // контейнер не пускает рендер в поддерево.
    <div data-testid={node.id}>
      {node.children?.map((c) => (
        <NodeRenderer key={c.id} node={c} />
      ))}
    </div>
  ),
}))

vi.mock('../lib/component-registry', () => ({
  getComponent: (type: string) =>
    type === 'UNREGISTERED' ? undefined : StubNode,
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

describe('NodeRenderer / якорь ошибки', () => {
  const KEY = '/documents/PutevoyList/1'
  const pole = {
    id: 'field.nomerPutevogoLista',
    type: 'TEXT_FIELD',
    binding: 'NomerPutevogoLista',
    props: {},
  } as unknown as ViewNode

  afterEach(() => {
    useValidationReportStore.setState({
      reports: {},
      activeIds: {},
      tooltipOpen: {},
      screenKey: null,
    })
  })

  it('снятие ошибки с поля не пересоздаёт его — иначе правка без blur не уходит на сервер', () => {
    useValidationReportStore.setState({ screenKey: KEY })
    useValidationReportStore.getState().setReport(KEY, {
      operation: 'post',
      blockingCount: 1,
      messages: [
        {
          id: 'm1',
          severity: 'ERROR',
          source: null,
          blocking: true,
          message: 'Не заполнено поле «№ путевого листа»',
          target: { kind: 'FIELD', fieldCode: 'NomerPutevogoLista' },
          attributeCode: null,
        },
      ],
    })

    const { getByTestId, container } = render(<NodeRenderer node={pole} />)
    const doSnyatiya = getByTestId('field.nomerPutevogoLista')
    expect(
      container.querySelector('[data-sdui-anchor="NomerPutevogoLista"]')
    ).not.toBeNull()

    act(() => {
      useValidationReportStore.getState().dismiss(KEY, ['m1'])
    })

    expect(getByTestId('field.nomerPutevogoLista')).toBe(doSnyatiya)
    expect(container.querySelector('[data-sdui-anchor]')).toBeNull()
  })

  it('узел без binding рендерится без обёртки', () => {
    const { container } = render(<NodeRenderer node={node('group.shapka')} />)
    expect(container.firstElementChild?.tagName).toBe('DIV')
  })
})
