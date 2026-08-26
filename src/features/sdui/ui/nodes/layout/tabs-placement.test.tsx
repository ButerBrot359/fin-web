import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { TabsNode } from './tabs-node'

vi.mock('../../../lib/dispatch', () => ({ useSduiDispatch: () => vi.fn() }))
vi.mock('../../node-renderer', () => ({
  NodeRenderer: ({ node }: { node: ViewNode }) => <span>{node.id}</span>,
}))

afterEach(cleanup)

// ЭСФ: 15 разделов A…K панелью слева («ОтображениеСтраниц = TabsOnLeftHorizontal»).
const node = (placement?: string): ViewNode =>
  ({
    id: 'tabs.razdely',
    type: 'TABS',
    props: placement === undefined ? {} : { tabsPlacement: placement },
    children: [
      {
        id: 'tab.razdelA',
        type: 'TAB',
        props: { title: 'A. Общий раздел', visible: true },
        children: [{ id: 'field.a', type: 'TEXT_FIELD' }],
      },
      {
        id: 'tab.razdelB',
        type: 'TAB',
        props: { title: 'B. Реквизиты', visible: true },
        children: [{ id: 'field.b', type: 'TEXT_FIELD' }],
      },
    ],
  }) as ViewNode

const tabList = () => screen.getByRole('tablist')

describe('TabsNode tabsPlacement', () => {
  it('LEFT → вертикальный список вкладок', () => {
    render(<TabsNode node={node('LEFT')} />)
    expect(tabList().className).toContain('MuiTabs-vertical')
    expect(screen.getByText('A. Общий раздел')).toBeTruthy()
  })

  it('LEFT → содержимое активной вкладки рядом со списком, а не под ним', () => {
    const { container } = render(<TabsNode node={node('LEFT')} />)
    const root = container.firstElementChild as HTMLElement
    expect(root.style.display).toBe('flex')
    // список и содержимое — соседи в строке
    expect(root.children).toHaveLength(2)
    expect(screen.getByText('field.a')).toBeTruthy()
  })

  it('пропа нет → вкладки сверху, как раньше', () => {
    const { container } = render(<TabsNode node={node()} />)
    expect(tabList().className).not.toContain('MuiTabs-vertical')
    expect((container.firstElementChild as HTMLElement).style.display).toBe('')
  })

  it('TOP явно → тоже сверху', () => {
    render(<TabsNode node={node('TOP')} />)
    expect(tabList().className).not.toContain('MuiTabs-vertical')
  })
})
