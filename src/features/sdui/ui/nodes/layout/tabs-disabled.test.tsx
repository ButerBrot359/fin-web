import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { TabsNode } from './tabs-node'

vi.mock('../../../lib/dispatch', () => ({ useSduiDispatch: () => vi.fn() }))
vi.mock('../../node-renderer', () => ({
  NodeRenderer: ({ node }: { node: ViewNode }) => <span>{node.id}</span>,
}))

afterEach(cleanup)

// SCRUM-70 §3: у группы доступа без видов доступа вкладка «Ограничения
// доступа» видима, но заблокирована (props.disabled с бэка).
const node = (
  tabProps: {
    first?: Record<string, unknown>
    second?: Record<string, unknown>
  } = {}
): ViewNode =>
  ({
    id: 'tabs.gruppa',
    type: 'TABS',
    props: {},
    children: [
      {
        id: 'tab.osnovnoe',
        type: 'TAB',
        props: { title: 'Основное', visible: true, ...tabProps.first },
        children: [{ id: 'field.main', type: 'TEXT_FIELD' }],
      },
      {
        id: 'tab.ogranicheniya',
        type: 'TAB',
        props: {
          title: 'Ограничения доступа',
          visible: true,
          ...tabProps.second,
        },
        children: [{ id: 'field.restr', type: 'TEXT_FIELD' }],
      },
    ],
  }) as ViewNode

describe('TabsNode props.disabled (SCRUM-70)', () => {
  it('disabled: true — вкладка видима, но MUI-таб заблокирован', () => {
    render(<TabsNode node={node({ second: { disabled: true } })} />)
    const tab = screen.getByRole('tab', { name: 'Ограничения доступа' })
    expect(tab.hasAttribute('disabled')).toBe(true)
  })

  it('отсутствие пропа и disabled: false — обычные вкладки', () => {
    render(<TabsNode node={node({ second: { disabled: false } })} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs.every((tabEl) => !tabEl.hasAttribute('disabled'))).toBe(true)
  })

  it('стартовая вкладка disabled — активной становится первая доступная', () => {
    render(<TabsNode node={node({ first: { disabled: true } })} />)
    // контент — с доступной второй вкладки, не с заблокированной первой
    expect(screen.getByText('field.restr')).toBeTruthy()
    expect(screen.queryByText('field.main')).toBeNull()
  })

  it('все вкладки disabled — рендер стабилен, контент клампнутой вкладки', () => {
    render(
      <TabsNode
        node={node({ first: { disabled: true }, second: { disabled: true } })}
      />
    )
    expect(screen.getByText('field.main')).toBeTruthy()
  })
})
