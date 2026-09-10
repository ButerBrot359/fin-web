import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { NavigateFunction } from 'react-router-dom'

import { useWorkspaceTabsStore } from '../hooks/use-workspace-tabs-store'
import { onPanelTabClose } from '../panel-tab-close-registry'
import { performTabClose } from './perform-tab-close'

const navigate = vi.fn() as unknown as NavigateFunction

describe('performTabClose', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useWorkspaceTabsStore.setState({
      tabs: [],
      activeTabId: null,
      activationOrder: [],
    })
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

  /**
   * Куда уходить, закрыв активную вкладку. Раньше активировался сосед ПО ПОЗИЦИИ, и закрытие
   * журнала «Начисление зарплаты» выбрасывало в журнал «Больничный лист» просто потому, что
   * тот стоял рядом в баре (разбор по логам 09.09.2026). Теперь: опенер → последняя активная
   * → сосед.
   */
  describe('возврат после закрытия активной вкладки', () => {
    const tab = (id: string, opener?: string) => ({
      id,
      path: id,
      search: '',
      title: id,
      pageType: 'document-list' as const,
      openerTabId: opener,
      createdAt: 1,
    })

    it('возвращает на вкладку-опенер, а не на соседа по позиции', () => {
      useWorkspaceTabsStore.setState({
        tabs: [
          tab('/zhurnal-zp'),
          tab('/bolnichnyy'),
          tab('/karta', '/zhurnal-zp'),
        ],
        activeTabId: '/karta',
        activationOrder: ['/karta', '/bolnichnyy', '/zhurnal-zp'],
      })

      performTabClose('/karta', navigate)

      expect(useWorkspaceTabsStore.getState().activeTabId).toBe('/zhurnal-zp')
      expect(navigate).toHaveBeenCalledWith('/zhurnal-zp')
    })

    it('опенера нет — возвращает на последнюю активную', () => {
      useWorkspaceTabsStore.setState({
        tabs: [tab('/zhurnal-zp'), tab('/bolnichnyy'), tab('/sklad')],
        activeTabId: '/sklad',
        activationOrder: ['/sklad', '/zhurnal-zp', '/bolnichnyy'],
      })

      performTabClose('/sklad', navigate)

      expect(useWorkspaceTabsStore.getState().activeTabId).toBe('/zhurnal-zp')
    })

    it('истории нет (после перезагрузки) — прежнее поведение, сосед по позиции', () => {
      useWorkspaceTabsStore.setState({
        tabs: [tab('/zhurnal-zp'), tab('/bolnichnyy'), tab('/sklad')],
        activeTabId: '/bolnichnyy',
        activationOrder: [],
      })

      performTabClose('/bolnichnyy', navigate)

      expect(useWorkspaceTabsStore.getState().activeTabId).toBe('/sklad')
    })

    it('закрыли НЕактивную вкладку — активная не меняется', () => {
      useWorkspaceTabsStore.setState({
        tabs: [tab('/zhurnal-zp'), tab('/bolnichnyy')],
        activeTabId: '/zhurnal-zp',
        activationOrder: ['/zhurnal-zp', '/bolnichnyy'],
      })

      performTabClose('/bolnichnyy', navigate)

      expect(useWorkspaceTabsStore.getState().activeTabId).toBe('/zhurnal-zp')
      expect(navigate).not.toHaveBeenCalled()
    })
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
