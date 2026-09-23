import { render, cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { PageNode } from './page-node'

vi.mock('../../node-renderer', () => ({
  NodeRenderer: ({ node }: { node: ViewNode }) => (
    <div data-testid={`stub-${node.id}`} />
  ),
}))

afterEach(cleanup)

const page = (children: ViewNode[]): ViewNode => ({
  id: 'module.page',
  type: 'PAGE',
  props: {
    title: 'Настройки пользователей и прав',
    subtitle:
      'Администрирование пользователей, настройка групп доступа, управление пользовательскими настройками.',
  },
  children,
})

describe('PAGE.props.subtitle (SCRUM-308 v3 §3)', () => {
  it('подзаголовок рисуется ПОД строкой тулбара (заголовок там)', () => {
    render(
      <PageNode
        node={page([
          { id: 'toolbar', type: 'TOOLBAR' },
          { id: 'grid', type: 'GRID' },
        ])}
      />
    )
    const subtitle = screen.getByText(/Администрирование пользователей/)
    const toolbar = screen.getByTestId('stub-toolbar')
    // Подзаголовок идёт в DOM сразу после тулбара, до остального содержимого
    expect(
      toolbar.compareDocumentPosition(subtitle) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    const grid = screen.getByTestId('stub-grid')
    expect(
      subtitle.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('без тулбара подзаголовок стоит верхом страницы', () => {
    render(<PageNode node={page([{ id: 'grid', type: 'GRID' }])} />)
    const subtitle = screen.getByText(/Администрирование пользователей/)
    const grid = screen.getByTestId('stub-grid')
    expect(
      subtitle.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('без пропа ничего лишнего не рисуется', () => {
    render(
      <PageNode
        node={{ id: 'p', type: 'PAGE', props: { title: 'X' }, children: [] }}
      />
    )
    expect(screen.queryByText(/Администрирование/)).toBeNull()
  })
})
