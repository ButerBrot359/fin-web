import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/assets/logo.svg', () => ({ default: () => null }))
vi.mock('@mui/icons-material', () => ({
  ChevronLeft: () => null,
  ChevronRight: () => null,
}))
vi.mock('../../../lib/shell/icon-resolver', () => ({
  resolveShellIcon: () => () => null,
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: '3rdParty', init: () => void 0 },
}))

import type { ViewNode } from '../../../types/view'
import { SidebarNode } from './sidebar-node'

const sidebar = (
  props: Record<string, unknown>,
  children: ViewNode[]
): ViewNode => ({ id: 's', type: 'SIDEBAR', props, children }) as ViewNode

const link = (id: string, label: string, route: string): ViewNode =>
  ({ id, type: 'LINK', props: { label, icon: 'home', route } }) as ViewNode

const tree = sidebar({ collapsed: false }, [
  link('n1', 'Главная', '/'),
  link('n2', 'Банк и касса', '/modules/Bank'),
])

describe('SidebarNode', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(cleanup)

  it('рендерит по пункту на каждый LINK-ребёнок', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <SidebarNode node={tree} />
      </MemoryRouter>
    )
    expect(screen.getByRole('button', { name: /Главная/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Банк и касса/ })).toBeTruthy()
  })

  it('кнопка сворачивания прячет метки пунктов и пишет localStorage', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <SidebarNode node={tree} />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByLabelText('sidebar.toggleCollapse'))
    expect(screen.queryByText('Банк и касса')).toBeNull()
    const stored = JSON.parse(localStorage.getItem('sidebar-settings')!) as {
      isCollapsed: boolean
    }
    expect(stored.isCollapsed).toBe(true)
  })

  it('стартовая свёрнутость берётся из localStorage поверх props.collapsed', () => {
    localStorage.setItem(
      'sidebar-settings',
      JSON.stringify({ isCollapsed: true })
    )
    render(
      <MemoryRouter initialEntries={['/']}>
        <SidebarNode node={tree} />
      </MemoryRouter>
    )
    expect(screen.queryByText('Главная')).toBeNull()
  })
})
