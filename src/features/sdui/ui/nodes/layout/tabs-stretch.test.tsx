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

  /**
   * Растягиваться — да, сжиматься ниже содержимого — нет. С `minHeight: 0`
   * лента ужималась под низкое окно, а таблица с её полом высоты вылезала за
   * границы ленты и рисовалась поверх итогов и подвала (Авансовый отчёт,
   * 10.09.2026).
   */
  it('у растянутой ленты есть пол высоты, а её содержимое остаётся сжимаемым', () => {
    render(<TabsNode node={tabs({ flex: 1 })} />)

    const content = screen.getByText('table.nachisleniya').parentElement
    // Внутреннее звено сжимается — иначе таблица растёт на всё содержимое и
    // теряет собственную прокрутку.
    expect(content?.style.minHeight).toBe('0px')
    // Внешнее не сжимается ниже минимума — иначе таблица вылезает за вкладку и
    // накладывается на подвал.
    expect(content?.parentElement?.style.minHeight).toBe('336px')
  })

  it('без пропа лента остаётся высотой по содержимому', () => {
    render(<TabsNode node={tabs({})} />)

    const content = screen.getByText('table.nachisleniya').parentElement
    expect(content?.style.flex).toBe('')
    expect(content?.parentElement?.style.flexDirection).toBe('')
  })
})
