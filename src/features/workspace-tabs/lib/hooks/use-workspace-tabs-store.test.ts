import { beforeEach, describe, expect, it, vi } from 'vitest'

import { notifyPanelTabClose, onPanelTabClose } from '../panel-tab-close-registry'
import { useWorkspaceTabsStore } from './use-workspace-tabs-store'

beforeEach(() => {
  sessionStorage.clear()
  useWorkspaceTabsStore.setState({ tabs: [], activeTabId: null })
})

describe('activateOrCreatePanel', () => {
  it('создаёт панельную вкладку без маршрута и активирует её', () => {
    useWorkspaceTabsStore.getState().activateOrCreatePanel('movements:1', 'Движения', 'p1')
    const s = useWorkspaceTabsStore.getState()
    expect(s.tabs).toHaveLength(1)
    expect(s.tabs[0]).toMatchObject({
      id: 'movements:1',
      path: '',
      search: '',
      title: 'Движения',
      pageType: 'sdui-panel',
      panelId: 'p1',
    })
    expect(s.activeTabId).toBe('movements:1')
  })

  it('повторный вызов с тем же tabKey переиспользует вкладку и обновляет panelId', () => {
    useWorkspaceTabsStore.getState().activateOrCreatePanel('movements:1', 'Движения', 'p1')
    useWorkspaceTabsStore.getState().activateOrCreate('/modules/x', '', 'module')
    useWorkspaceTabsStore.getState().activateOrCreatePanel('movements:1', 'Движения', 'p2')
    const s = useWorkspaceTabsStore.getState()
    expect(s.tabs.filter((t) => t.id === 'movements:1')).toHaveLength(1)
    expect(s.tabs.find((t) => t.id === 'movements:1')?.panelId).toBe('p2')
    expect(s.activeTabId).toBe('movements:1')
  })
})

describe('персист панельных вкладок', () => {
  it('sdui-panel вкладки не попадают в снимок; activeTabId-панель сбрасывается в null', () => {
    useWorkspaceTabsStore.getState().activateOrCreate('/modules/x', '', 'module')
    useWorkspaceTabsStore.getState().activateOrCreatePanel('movements:1', 'Движения', 'p1')
    const raw = sessionStorage.getItem('workspace-tabs')
    expect(raw).not.toBeNull()
    const persisted = JSON.parse(raw!) as {
      state: { tabs: { id: string }[]; activeTabId: string | null }
    }
    expect(persisted.state.tabs.map((t) => t.id)).toEqual(['/modules/x'])
    expect(persisted.state.activeTabId).toBeNull()
  })
})

describe('panel-tab-close-registry', () => {
  it('уведомляет подписчиков и отписывает', () => {
    const cb = vi.fn()
    const unsubscribe = onPanelTabClose(cb)
    notifyPanelTabClose('p1')
    expect(cb).toHaveBeenCalledWith('p1')
    unsubscribe()
    notifyPanelTabClose('p2')
    expect(cb).toHaveBeenCalledTimes(1)
  })
})
