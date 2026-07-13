import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { NavigateFunction } from 'react-router-dom'

import { useWorkspaceTabsStore } from '../hooks/use-workspace-tabs-store'
import type { WorkspaceTab } from '../../types/workspace-tab'
import { performTabBack } from './perform-tab-back'

const navigate = vi.fn() as unknown as NavigateFunction

const routeTab = (id: string): WorkspaceTab => ({
  id,
  path: id,
  search: '?a=1',
  title: 'Документ',
  pageType: 'document-entry',
  createdAt: 1,
})

const panelTab = (id: string, openerTabId?: string): WorkspaceTab => ({
  id,
  path: '',
  search: '',
  title: 'Связанные',
  pageType: 'sdui-panel',
  panelId: `panel-${id}`,
  createdAt: 2,
  openerTabId,
})

describe('performTabBack', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useWorkspaceTabsStore.setState({ tabs: [], activeTabId: null })
  })

  it('роутовый опенер: активирует его, навигирует, обе вкладки живы', () => {
    useWorkspaceTabsStore.setState({
      tabs: [routeTab('/doc/1'), panelTab('related:1', '/doc/1')],
      activeTabId: 'related:1',
    })

    performTabBack('related:1', navigate)

    const s = useWorkspaceTabsStore.getState()
    expect(s.activeTabId).toBe('/doc/1')
    expect(s.tabs).toHaveLength(2)
    expect(navigate).toHaveBeenCalledWith('/doc/1?a=1')
  })

  it('панельный опенер: setActiveTab без навигации', () => {
    useWorkspaceTabsStore.setState({
      tabs: [panelTab('movements:1'), panelTab('related:1', 'movements:1')],
      activeTabId: 'related:1',
    })

    performTabBack('related:1', navigate)

    expect(useWorkspaceTabsStore.getState().activeTabId).toBe('movements:1')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('опенер отсутствует: fallback на закрытие вкладки', () => {
    useWorkspaceTabsStore.setState({
      tabs: [panelTab('related:1', '/gone')],
      activeTabId: 'related:1',
    })

    performTabBack('related:1', navigate)

    expect(useWorkspaceTabsStore.getState().tabs).toHaveLength(0)
    expect(navigate).toHaveBeenCalledWith('/')
  })
})
