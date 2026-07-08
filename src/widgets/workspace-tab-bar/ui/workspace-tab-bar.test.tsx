import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  onPanelTabClose,
  useWorkspaceTabsStore,
} from '@/features/workspace-tabs'

import { WorkspaceTabBar } from './workspace-tab-bar'

vi.mock('@/shared/assets/icons/cross.svg', () => ({
  default: () => null,
}))

const LocationProbe = () => {
  const location = useLocation()
  return <div data-testid="loc">{location.pathname}</div>
}

const formTab = {
  id: '/documents/42',
  path: '/documents/42',
  search: '',
  title: 'Документ 42',
  pageType: 'document-entry' as const,
  createdAt: 1,
}

const panelTab = {
  id: 'movements:42',
  path: '',
  search: '',
  title: 'Движения 42',
  pageType: 'sdui-panel' as const,
  panelId: 'p-42',
  createdAt: 2,
}

const renderBar = () =>
  render(
    <MemoryRouter initialEntries={['/documents/42']}>
      <WorkspaceTabBar />
      <LocationProbe />
    </MemoryRouter>,
  )

describe('WorkspaceTabBar: панельные вкладки', () => {
  beforeEach(() => {
    sessionStorage.clear()
    useWorkspaceTabsStore.setState({
      tabs: [formTab, panelTab],
      activeTabId: formTab.id,
    })
  })
  afterEach(cleanup)

  it('активация панельной вкладки не навигирует', () => {
    renderBar()
    fireEvent.click(screen.getByText('Движения 42'))
    expect(useWorkspaceTabsStore.getState().activeTabId).toBe('movements:42')
    expect(screen.getByTestId('loc').textContent).toBe('/documents/42')
  })

  it('закрытие панельной вкладки уведомляет реестр её panelId', () => {
    const onClose = vi.fn()
    const unsubscribe = onPanelTabClose(onClose)
    renderBar()

    // Кнопка-крестик — вложенный span[role=button] внутри кнопки вкладки
    const tabButton = screen.getByText('Движения 42').closest('button')!
    fireEvent.click(within(tabButton).getByRole('button'))

    expect(onClose).toHaveBeenCalledWith('p-42')
    expect(useWorkspaceTabsStore.getState().tabs.map((t) => t.id)).toEqual([
      '/documents/42',
    ])
    unsubscribe()
  })
})
