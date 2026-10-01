import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { NavigateFunction } from 'react-router-dom'

import { useFormCacheStore } from '../hooks/use-form-cache-store'
import { useWorkspaceTabsStore } from '../hooks/use-workspace-tabs-store'
import { onPanelTabClose } from '../panel-tab-close-registry'
import { onTabDiscardClose } from '../tab-discard-registry'
import { findDirtyTabIds, performCloseAllTabs } from './perform-close-all-tabs'

const navigate = vi.fn() as unknown as NavigateFunction

const docTab = {
  id: '/modules/Kassa/document/PKO/1',
  path: '/modules/Kassa/document/PKO/1',
  search: '',
  title: 'ПКО 1',
  pageType: 'document-entry' as const,
  createdAt: 1,
}

const reportTab = {
  id: '/modules/Otchety/reportalt/OSV',
  path: '/modules/Otchety/reportalt/OSV',
  search: '?rp=1',
  title: 'Оборотно-сальдовая ведомость',
  pageType: 'reportalt' as const,
  createdAt: 2,
}

const panelTab = {
  id: 'movements:1',
  path: '',
  search: '',
  title: 'Движения',
  pageType: 'sdui-panel' as const,
  panelId: 'p-1',
  createdAt: 3,
}

describe('performCloseAllTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useWorkspaceTabsStore.setState({
      tabs: [docTab, reportTab, panelTab],
      activeTabId: reportTab.id,
      activationOrder: [reportTab.id, docTab.id],
    })
    useFormCacheStore.setState({ cache: {}, pendingActions: {} })
  })

  it('закрывает все вкладки, снимает кэш форм и уходит на главную', () => {
    useFormCacheStore.setState({
      cache: { [docTab.id]: { values: { a: 1 }, isDirty: false } },
    })

    performCloseAllTabs(navigate)

    const state = useWorkspaceTabsStore.getState()
    expect(state.tabs).toEqual([])
    expect(state.activeTabId).toBeNull()
    expect(useFormCacheStore.getState().cache[docTab.id]).toBeUndefined()
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith('/')
  })

  it('панельной вкладке сообщает о закрытии, изменённой — о закрытии без сохранения', () => {
    useFormCacheStore.setState({
      cache: { [docTab.id]: { values: null, isDirty: true } },
    })
    const panels: string[] = []
    const discarded: string[] = []
    const offPanel = onPanelTabClose((id) => panels.push(id))
    const offDiscard = onTabDiscardClose((id) => discarded.push(id))

    performCloseAllTabs(navigate)

    expect(panels).toEqual(['p-1'])
    expect(discarded).toEqual([docTab.id])
    offPanel()
    offDiscard()
  })

  it('findDirtyTabIds отдаёт только вкладки с несохранёнными изменениями', () => {
    useFormCacheStore.setState({
      cache: {
        [docTab.id]: { values: null, isDirty: true },
        [reportTab.id]: { values: null, isDirty: false },
      },
    })
    expect(findDirtyTabIds()).toEqual([docTab.id])
  })

  it('без вкладок ничего не делает', () => {
    useWorkspaceTabsStore.setState({ tabs: [], activeTabId: null })
    performCloseAllTabs(navigate)
    expect(navigate).not.toHaveBeenCalled()
  })
})
