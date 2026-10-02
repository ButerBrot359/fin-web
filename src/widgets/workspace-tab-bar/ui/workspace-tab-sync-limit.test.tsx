import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'

import {
  MAX_TABS,
  useFormCacheStore,
  useWorkspaceTabsStore,
} from '@/features/workspace-tabs'
import type { WorkspaceTab } from '@/features/workspace-tabs'

import { WorkspaceTabSync } from './workspace-tab-sync'

vi.mock('@/shared/ui/toast/show-toast', () => ({ showToast: vi.fn() }))

const Probe = () => {
  const navigate = useNavigate()
  return (
    <>
      <div data-testid="loc">{useLocation().pathname}</div>
      <button
        type="button"
        onClick={() => {
          void navigate('/modules/m/document/D/new-one')
        }}
      >
        открыть
      </button>
    </>
  )
}

const tabs: WorkspaceTab[] = Array.from({ length: MAX_TABS }, (_, i) => ({
  id: `/modules/m/document/D/${String(i)}`,
  path: `/modules/m/document/D/${String(i)}`,
  search: '',
  title: `Д ${String(i)}`,
  pageType: 'document-entry',
  createdAt: i,
}))

describe('WorkspaceTabSync: лимит вкладок, все изменены (D9)', () => {
  beforeEach(() => {
    sessionStorage.clear()
    useWorkspaceTabsStore.setState({
      tabs,
      activeTabId: tabs[0].id,
      activationOrder: [],
      forceNewTab: false,
    })
    useFormCacheStore.setState({
      cache: Object.fromEntries(
        tabs.map((t) => [t.id, { values: null, isDirty: true }])
      ),
      pendingActions: {},
    })
  })
  afterEach(cleanup)

  it('новая вкладка не открывается, адрес возвращается на активную вкладку', () => {
    render(
      <MemoryRouter initialEntries={[tabs[0].path]}>
        <WorkspaceTabSync />
        <Probe />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByText('открыть'))

    expect(useWorkspaceTabsStore.getState().tabs).toHaveLength(MAX_TABS)
    expect(screen.getByTestId('loc').textContent).toBe(tabs[0].path)
  })
})
