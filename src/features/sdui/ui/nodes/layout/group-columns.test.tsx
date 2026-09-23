import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../../types/view'
import { GroupNode } from './group-node'

vi.mock('../../node-renderer', () => ({
  NodeRenderer: ({ node }: { node: ViewNode }) => (
    <div data-testid={`stub-${node.id}`} />
  ),
}))

afterEach(cleanup)

describe('GROUP: columnsCount и кликабельный заголовок (SCRUM-355 §8.7)', () => {
  it('columnsCount раскладывает детей сеткой из N колонок', () => {
    const { container } = render(
      <GroupNode
        node={{
          id: 'g',
          type: 'GROUP',
          props: { title: 'Настройки почты', columnsCount: 2 },
          children: [
            { id: 'a', type: 'TEXT_FIELD' },
            { id: 'b', type: 'TEXT_FIELD' },
          ],
        }}
      />
    )
    const grid = [...container.querySelectorAll('div')].find(
      (d) => d.style.display === 'grid'
    )
    expect(grid?.style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))')
  })

  it('без columnsCount — прежняя колонка потоком', () => {
    const { container } = render(
      <GroupNode
        node={{
          id: 'g',
          type: 'GROUP',
          props: { title: 'Обычная' },
          children: [{ id: 'a', type: 'TEXT_FIELD' }],
        }}
      />
    )
    expect(
      [...container.querySelectorAll('div')].some(
        (d) => d.style.display === 'grid'
      )
    ).toBe(false)
  })

  it('сворачиваемую группу переключает ВСЯ строка заголовка, включая клавиатуру', () => {
    render(
      <GroupNode
        node={{
          id: 'g',
          type: 'GROUP',
          props: { title: 'Персональные настройки', collapsible: true },
          children: [{ id: 'a', type: 'TEXT_FIELD' }],
        }}
      />
    )
    const header = screen.getByRole('button', { expanded: true })
    fireEvent.click(header)
    expect(header.getAttribute('aria-expanded')).toBe('false')
    fireEvent.keyDown(header, { key: 'Enter' })
    expect(header.getAttribute('aria-expanded')).toBe('true')
    fireEvent.keyDown(header, { key: ' ' })
    expect(header.getAttribute('aria-expanded')).toBe('false')
  })
})
