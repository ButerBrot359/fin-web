import { MemoryRouter } from 'react-router-dom'
import { render, cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { LinkNode } from './link-node'

vi.mock('../../../lib/dispatch', () => ({ useSduiDispatch: () => vi.fn() }))

afterEach(cleanup)

const node = (props: Record<string, unknown>): ViewNode => ({
  id: 'module.item',
  type: 'LINK',
  props,
})

describe('LINK.props.description (SCRUM-308 v3 §3)', () => {
  it('пояснение рисуется серым текстом под ссылкой', () => {
    render(
      <MemoryRouter>
        <LinkNode
          node={node({
            text: 'Пользователи',
            variant: 'module-link',
            route: '/x',
            description:
              'Ведение списка пользователей, которые работают с программой.',
          })}
        />
      </MemoryRouter>
    )
    const link = screen.getByText('Пользователи')
    const description = screen.getByText(/Ведение списка пользователей/)
    expect(
      link.compareDocumentPosition(description) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('ключа нет вовсе — рисуется только ссылка', () => {
    const { container } = render(
      <MemoryRouter>
        <LinkNode
          node={node({
            text: 'Группы доступа',
            variant: 'module-link',
            route: '/y',
          })}
        />
      </MemoryRouter>
    )
    expect(container.querySelectorAll('p').length).toBe(0)
    expect(screen.getByText('Группы доступа')).toBeTruthy()
  })
})
