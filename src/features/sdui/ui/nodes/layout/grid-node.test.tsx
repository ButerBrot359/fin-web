import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { GridNode } from './grid-node'

vi.mock('../../node-renderer', () => ({
  NodeRenderer: ({ node }: { node: ViewNode }) => (
    <span data-testid={node.id} />
  ),
}))

const cell = (id: string, props: Record<string, unknown> = {}): ViewNode =>
  ({ id, type: 'TEXT_FIELD', props }) as ViewNode

const grid = (children: ViewNode[]): ViewNode =>
  ({
    id: 'g',
    type: 'GRID',
    props: { columns: 24, gap: 3, columnGap: 6 },
    children,
  }) as ViewNode

describe('GridNode (грид-модель шапки)', () => {
  it('colSpan → span N, newRow → старт с первой колонки, дефолт — вся строка', () => {
    const { getByTestId } = render(
      <GridNode
        node={grid([
          cell('a', { colSpan: 12 }),
          cell('b', { colSpan: 6, newRow: true }),
          cell('c'),
        ])}
      />
    )

    expect(getByTestId('a').parentElement!.style.gridColumn).toBe('span 12')
    expect(getByTestId('b').parentElement!.style.gridColumn).toBe('1 / span 6')
    expect(getByTestId('c').parentElement!.style.gridColumn).toBe('span 1')
  })

  it('кламп colSpan к числу колонок, раздельные row/column gap', () => {
    const { getByTestId, container } = render(
      <GridNode node={grid([cell('k', { colSpan: 99 })])} />
    )

    expect(getByTestId('k').parentElement!.style.gridColumn).toBe('span 24')
    const root = container.firstElementChild as HTMLElement
    expect(root.style.getPropertyValue('row-gap')).toBe('12px')
    expect(root.style.getPropertyValue('column-gap')).toBe('24px')
  })

  it('SPACER — пустая клетка со своим span; скрытые ноды не рендерятся', () => {
    const spacer = {
      id: 'spacer.grid.1',
      type: 'SPACER',
      props: { colSpan: 12 },
    } as ViewNode
    const { container, queryByTestId } = render(
      <GridNode node={grid([spacer, cell('h', { visible: false })])} />
    )

    const gridEl = container.firstElementChild as HTMLElement
    const spacerCell = gridEl.firstElementChild as HTMLElement
    expect(spacerCell.style.gridColumn).toBe('span 12')
    expect(spacerCell.childElementCount).toBe(0)
    expect(queryByTestId('h')).toBeNull()
  })
})
