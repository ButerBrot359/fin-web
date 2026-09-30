import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../lib/shell/icon-resolver', () => ({
  resolveShellIcon: () => () => null,
}))

const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual =
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

import { useWorkspaceTabsStore } from '@/features/workspace-tabs'

import type { ViewNode } from '../../../types/view'
import { SidebarLinkItem } from './sidebar-link-item'

const link = (props: Record<string, unknown>): ViewNode =>
  ({ id: 'l1', type: 'LINK', props }) as ViewNode

describe('SidebarLinkItem', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('рендерит label и по клику навигирует на route', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <SidebarLinkItem
          node={link({
            label: 'Банк и касса',
            icon: 'bank',
            route: '/modules/Bank',
          })}
          collapsed={false}
        />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByRole('button', { name: /Банк и касса/ }))
    expect(navigate).toHaveBeenCalledWith('/modules/Bank')
  })

  it('повторное нажатие на открытый раздел закрывает его вкладку', () => {
    useWorkspaceTabsStore.setState({
      tabs: [
        {
          id: '/modules/ZarplatiIKadri',
          path: '/modules/ZarplatiIKadri',
          search: '',
          title: 'Зарплата и кадры',
          pageType: 'module',
          createdAt: 1,
        },
      ],
      activeTabId: '/modules/ZarplatiIKadri',
      activationOrder: ['/modules/ZarplatiIKadri'],
    })
    render(
      <MemoryRouter initialEntries={['/modules/ZarplatiIKadri']}>
        <SidebarLinkItem
          node={link({
            label: 'Зарплата и кадры',
            icon: 'salary',
            route: '/modules/ZarplatiIKadri',
          })}
          collapsed={false}
        />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByRole('button', { name: /Зарплата и кадры/ }))
    expect(useWorkspaceTabsStore.getState().tabs).toHaveLength(0)
    expect(navigate).toHaveBeenCalledWith('/')
  })

  it('активен, когда pathname совпадает с route (startsWith для не-корня)', () => {
    render(
      <MemoryRouter initialEntries={['/modules/Bank/document/X']}>
        <SidebarLinkItem
          node={link({
            label: 'Банк и касса',
            icon: 'bank',
            route: '/modules/Bank',
          })}
          collapsed={false}
        />
      </MemoryRouter>
    )
    expect(
      screen
        .getByRole('button', { name: /Банк и касса/ })
        .getAttribute('aria-current')
    ).toBe('page')
  })

  it('корневой route "/" активен только при точном совпадении', () => {
    render(
      <MemoryRouter initialEntries={['/modules/Bank']}>
        <SidebarLinkItem
          node={link({ label: 'Главная', icon: 'home', route: '/' })}
          collapsed={false}
        />
      </MemoryRouter>
    )
    expect(
      screen
        .getByRole('button', { name: /Главная/ })
        .getAttribute('aria-current')
    ).toBeNull()
  })

  it('свёрнутый режим прячет label (иконка остаётся)', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <SidebarLinkItem
          node={link({
            label: 'Банк и касса',
            icon: 'bank',
            route: '/modules/Bank',
          })}
          collapsed={true}
        />
      </MemoryRouter>
    )
    expect(screen.queryByText('Банк и касса')).toBeNull()
  })
})
