import { render, screen, cleanup } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { TabsNode } from './tabs-node'

vi.mock('../../node-renderer', () => ({
  NodeRenderer: ({ node }: { node: ViewNode }) => <div>{node.id}</div>,
}))
vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => vi.fn(),
}))

const tabs = (props: Record<string, unknown>): ViewNode =>
  ({
    id: 'tabs.main',
    type: 'TABS',
    props,
    children: [
      {
        id: 'tab.nachisleniya',
        type: 'TAB',
        props: { visible: true, title: 'Начисления' },
        children: [{ id: 'table.nachisleniya', type: 'TABLE' }],
      },
    ],
  }) as unknown as ViewNode

describe('растяжка ленты вкладок по props.flex', () => {
  beforeEach(cleanup)

  it('с props.flex лента и её содержимое становятся растягивающейся колонкой', () => {
    render(<TabsNode node={tabs({ flex: 1 })} />)

    const content = screen.getByText('table.nachisleniya').parentElement
    expect(content?.style.flex).toBe('1 1 0%')
    expect(content?.style.minHeight).toBe('0px')
    expect(content?.parentElement?.style.flexDirection).toBe('column')
  })

  it('без пропа лента остаётся высотой по содержимому', () => {
    render(<TabsNode node={tabs({})} />)

    const content = screen.getByText('table.nachisleniya').parentElement
    expect(content?.style.flex).toBe('')
    expect(content?.parentElement?.style.flexDirection).toBe('')
  })
})
