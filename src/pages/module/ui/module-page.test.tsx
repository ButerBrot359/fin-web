import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useWorkspaceTabsStore } from '@/features/workspace-tabs'

import { ModulePage } from './module-page'

vi.mock('@/features/sdui', () => ({
  mapKindToPageType: (kind: string) => (kind === 'MODULE' ? 'module' : null),
  SduiScreen: ({
    onTab,
    onOpenFailed,
  }: {
    onTab?: (tab: { kind: string; title?: string }) => void
    onOpenFailed?: () => void
  }) => (
    <div data-testid="sdui-module-page">
      <button onClick={() => onTab?.({ kind: 'MODULE', title: 'Казна' })}>
        receive-server-tab
      </button>
      <button onClick={() => onOpenFailed?.()}>open-failed</button>
    </div>
  ),
}))

vi.mock('@/entities/module', () => ({
  useModule: () => ({ data: [] }),
}))
vi.mock('@/widgets/module-toolbar', () => ({
  ModuleToolbar: ({ title }: { title: string }) => (
    <div>legacy-toolbar:{title}</div>
  ),
}))
vi.mock('../lib/hooks/use-page-title', () => ({
  usePageTitle: () => 'Legacy module',
}))
vi.mock('../lib/hooks/use-ready-reports-section', () => ({
  useReadyReportsSection: () => null,
}))
vi.mock('./module-nav-list', () => ({
  ModuleNavList: () => null,
}))
vi.mock('./module-nav-skeleton', () => ({
  ModuleNavSkeleton: () => null,
}))

const Harness = () => {
  const navigate = useNavigate()
  return (
    <>
      <button onClick={() => void navigate('/modules/second')}>
        open-second-module
      </button>
      <Routes>
        <Route path="/modules/:pageCode" element={<ModulePage />} />
      </Routes>
    </>
  )
}

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Harness />
    </MemoryRouter>
  )

describe('ModulePage (SCRUM-181, SDUI-first)', () => {
  beforeEach(() => {
    useWorkspaceTabsStore.setState({ tabs: [], activeTabId: null })
  })
  afterEach(cleanup)

  it('uses the server-provided MODULE tab title', () => {
    renderAt('/modules/kazna')
    fireEvent.click(screen.getByRole('button', { name: 'receive-server-tab' }))

    expect(useWorkspaceTabsStore.getState().tabs).toMatchObject([
      { path: '/modules/kazna', pageType: 'module', title: 'Казна' },
    ])
  })

  it('limits a legacy fallback to the module whose OPEN failed', () => {
    renderAt('/modules/first')
    fireEvent.click(screen.getByRole('button', { name: 'open-failed' }))
    expect(screen.getByText('legacy-toolbar:Legacy module')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'open-second-module' }))
    expect(screen.getByTestId('sdui-module-page')).toBeTruthy()
  })
})
