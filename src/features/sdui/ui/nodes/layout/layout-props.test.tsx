import type { FC, PropsWithChildren } from 'react'
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const Wrapper: FC<PropsWithChildren> = ({ children }) => (
  <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter>{children}</MemoryRouter>
  </QueryClientProvider>
)

import type { ViewNode } from '../../../types/view'
import { VStackNode } from './vstack-node'
import { HStackNode } from './hstack-node'

const label = (id: string, text: string): ViewNode =>
  ({ id, type: 'LABEL', props: { text } }) as ViewNode

describe('layout-пропы конструктора дизайна (v2)', () => {
  it('pinBottom: ребёнок VSTACK прижимается к низу через marginTop:auto', () => {
    const node = {
      id: 'v',
      type: 'VSTACK',
      children: [
        label('a', 'верх'),
        { ...label('b', 'низ'), props: { text: 'низ', pinBottom: true } },
      ],
    } as ViewNode
    const { container } = render(<VStackNode node={node} />, {
      wrapper: Wrapper,
    })
    const pinned = [...container.querySelectorAll('div')].find(
      (d) => d.style.marginTop === 'auto'
    )
    expect(pinned?.textContent).toBe('низ')
  })

  it('dividers: колонки HSTACK, кроме первой, получают левую линию ui-03', () => {
    const node = {
      id: 'h',
      type: 'HSTACK',
      props: { dividers: true, gap: 4 },
      children: [label('l', 'левая'), label('r', 'правая')],
    } as ViewNode
    const { container } = render(<HStackNode node={node} />, {
      wrapper: Wrapper,
    })
    const cols = [...(container.firstElementChild?.children ?? [])]
    expect((cols[0] as HTMLElement).style.borderLeft).toBe('')
    expect((cols[1] as HTMLElement).style.borderLeft).toContain('--ui-03')
    expect((cols[1] as HTMLElement).style.paddingLeft).toBe('16px')
  })

  it('без dividers линий нет', () => {
    const node = {
      id: 'h2',
      type: 'HSTACK',
      children: [label('l', 'л'), label('r', 'п')],
    } as ViewNode
    const { container } = render(<HStackNode node={node} />, {
      wrapper: Wrapper,
    })
    const cols = [...(container.firstElementChild?.children ?? [])]
    expect((cols[1] as HTMLElement).style.borderLeft).toBe('')
  })
})
