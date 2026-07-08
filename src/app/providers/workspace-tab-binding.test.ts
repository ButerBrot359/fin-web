import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { openPanelTab, usePanelStore } from '@/features/sdui'
import {
  notifyPanelTabClose,
  useWorkspaceTabsStore,
} from '@/features/workspace-tabs'

import { useWorkspaceTabGatewayBinding } from './workspace-tab-binding'

describe('useWorkspaceTabGatewayBinding', () => {
  beforeEach(() => {
    sessionStorage.clear()
    useWorkspaceTabsStore.setState({ tabs: [], activeTabId: null })
    usePanelStore.setState({ panels: [] })
  })

  it('связывает openPanelTab SDUI с activateOrCreatePanel', () => {
    const { unmount } = renderHook(() => useWorkspaceTabGatewayBinding())

    const ok = openPanelTab({
      tabKey: 'movements:1',
      title: 'Движения',
      panelId: 'p1',
    })

    expect(ok).toBe(true)
    expect(useWorkspaceTabsStore.getState().tabs[0]).toMatchObject({
      id: 'movements:1',
      title: 'Движения',
      pageType: 'sdui-panel',
      panelId: 'p1',
    })
    unmount()
  })

  it('закрытие панельной вкладки удаляет панель из panel-store', () => {
    const { unmount } = renderHook(() => useWorkspaceTabGatewayBinding())
    usePanelStore.setState({
      panels: [
        {
          panelId: 'p1',
          node: { id: 'n', type: 'CONTAINER' },
          presentation: 'page',
          viewState: {},
        },
      ],
    })

    notifyPanelTabClose('p1')

    expect(usePanelStore.getState().panels).toHaveLength(0)
    unmount()
  })

  it('после unmount гейтвей отвязан (openPanelTab → false)', () => {
    const { unmount } = renderHook(() => useWorkspaceTabGatewayBinding())
    unmount()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      openPanelTab({ tabKey: 'movements:2', title: 'Движения', panelId: 'p2' }),
    ).toBe(false)
    warn.mockRestore()
  })
})
