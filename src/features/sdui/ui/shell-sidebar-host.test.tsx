import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const useAppShellSidebar = vi.fn<
  () => {
    sidebarNode: { id: string; type: string } | null
    isPending: boolean
    isError: boolean
  }
>()
vi.mock('../lib/shell/use-app-shell-sidebar', () => ({
  useAppShellSidebar: () => useAppShellSidebar(),
}))
vi.mock('./node-renderer', () => ({
  NodeRenderer: ({ node }: { node: { id: string } }) => (
    <div data-testid="node-renderer">{node.id}</div>
  ),
}))

import { ShellSidebarHost } from './shell-sidebar-host'

const fallback = <div data-testid="legacy-fallback">legacy</div>

describe('ShellSidebarHost', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('данные есть → рендерит NodeRenderer с SIDEBAR-узлом', () => {
    useAppShellSidebar.mockReturnValue({
      sidebarNode: { id: 'sb', type: 'SIDEBAR' },
      isPending: false,
      isError: false,
    })
    render(<ShellSidebarHost fallback={fallback} />)
    expect(screen.getByTestId('node-renderer').textContent).toBe('sb')
    expect(screen.queryByTestId('legacy-fallback')).toBeNull()
  })

  it('загрузка → фолбэк', () => {
    useAppShellSidebar.mockReturnValue({
      sidebarNode: null,
      isPending: true,
      isError: false,
    })
    render(<ShellSidebarHost fallback={fallback} />)
    expect(screen.getByTestId('legacy-fallback')).toBeTruthy()
  })

  it('ошибка → фолбэк', () => {
    useAppShellSidebar.mockReturnValue({
      sidebarNode: null,
      isPending: false,
      isError: true,
    })
    render(<ShellSidebarHost fallback={fallback} />)
    expect(screen.getByTestId('legacy-fallback')).toBeTruthy()
  })
})
