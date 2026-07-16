import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { HStackNode } from './hstack-node'

vi.mock('../../node-renderer', () => ({
  NodeRenderer: ({ node }: { node: ViewNode }) => (
    <span data-testid={node.id} />
  ),
}))

const child = (id: string, flex?: number | string): ViewNode =>
  ({ id, type: 'TABLE', props: flex !== undefined ? { flex } : {} }) as ViewNode

describe('HStackNode', () => {
  it('оборачивает детей в контейнеры flex:1 minWidth:0 (равное деление)', () => {
    const node = {
      id: 'h1',
      type: 'HSTACK',
      props: {},
      children: [child('t1'), child('t2')],
    } as ViewNode
    const { getByTestId } = render(<HStackNode node={node} />)
    const wrapper = getByTestId('t1').parentElement as HTMLElement
    expect(wrapper.style.flex).toBe('1 1 0%')
    expect(wrapper.style.minWidth).toBe('0px')
    const wrapper2 = getByTestId('t2').parentElement as HTMLElement
    expect(wrapper2.style.flex).toBe('1 1 0%')
  })

  it('уважает props.flex ребёнка, если задан', () => {
    const node = {
      id: 'h2',
      type: 'HSTACK',
      props: {},
      children: [child('t3', 2), child('t4')],
    } as ViewNode
    const { getByTestId } = render(<HStackNode node={node} />)
    const wrapper = getByTestId('t3').parentElement as HTMLElement
    expect(wrapper.style.flexGrow).toBe('2')
  })
})
