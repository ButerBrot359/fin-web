import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { NavigateFunction } from 'react-router-dom'

import { useWorkspaceTabsStore } from '../hooks/use-workspace-tabs-store'
import { onPanelTabClose } from '../panel-tab-close-registry'
import { performTabClose } from './perform-tab-close'

const navigate = vi.fn() as unknown as NavigateFunction

describe('performTabClose', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useWorkspaceTabsStore.setState({ tabs: [], activeTabId: null })
  })

  it('панельная вкладка: уведомляет реестр и навигирует на соседнюю роут-вкладку', () => {
    useWorkspaceTabsStore.setState({
      tabs: [
        {
          id: '/list',
          path: '/list',
          search: '?a=1',
          title: 'Список',
          pageType: 'document-list',
          createdAt: 1,
        },
        {
          id: 'movements:1',
          path: '',
          search: '',
          title: 'Движения',
          pageType: 'sdui-panel',
          panelId: 'p-1',
          createdAt: 2,
        },
      ],
      activeTabId: 'movements:1',
    })
    const closedPanels: string[] = []
    const unsubscribe = onPanelTabClose((panelId) => closedPanels.push(panelId))

    performTabClose('movements:1', navigate)

    expect(closedPanels).toEqual(['p-1'])
    expect(useWorkspaceTabsStore.getState().tabs).toHaveLength(1)
    expect(navigate).toHaveBeenCalledWith('/list?a=1')
    unsubscribe()
  })

  it('последняя вкладка: навигация на корень', () => {
    useWorkspaceTabsStore.setState({
      tabs: [
        {
          id: 'movements:1',
          path: '',
          search: '',
          title: 'Движения',
          pageType: 'sdui-panel',
          panelId: 'p-1',
          createdAt: 1,
        },
      ],
      activeTabId: 'movements:1',
    })

    performTabClose('movements:1', navigate)

    expect(useWorkspaceTabsStore.getState().tabs).toHaveLength(0)
    expect(navigate).toHaveBeenCalledWith('/')
  })

  it('закрытие неактивной вкладки: без навигации', () => {
    useWorkspaceTabsStore.setState({
      tabs: [
        {
          id: '/list',
          path: '/list',
          search: '',
          title: 'Список',
          pageType: 'document-list',
          createdAt: 1,
        },
        {
          id: 'movements:1',
          path: '',
          search: '',
          title: 'Движения',
          pageType: 'sdui-panel',
          panelId: 'p-1',
          createdAt: 2,
        },
      ],
      activeTabId: '/list',
    })

    performTabClose('movements:1', navigate)

    expect(navigate).not.toHaveBeenCalled()
  })
})
