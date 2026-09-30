import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { NavigateFunction } from 'react-router-dom'

import type { WorkspaceTab } from '../../types/workspace-tab'
import { useWorkspaceTabsStore } from '../hooks/use-workspace-tabs-store'
import { performSectionToggle } from './perform-section-toggle'

const navigate = vi.fn() as unknown as NavigateFunction

const tab = (patch: Partial<WorkspaceTab>): WorkspaceTab => ({
  id: '/modules/ZarplatiIKadri',
  path: '/modules/ZarplatiIKadri',
  search: '',
  title: 'Зарплата и кадры',
  pageType: 'module',
  createdAt: 1,
  ...patch,
})

describe('performSectionToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useWorkspaceTabsStore.setState({
      tabs: [],
      activeTabId: null,
      activationOrder: [],
    })
  })

  it('закрытый раздел открывается переходом на его route', () => {
    performSectionToggle('/modules/ZarplatiIKadri', '/', navigate)

    expect(navigate).toHaveBeenCalledWith('/modules/ZarplatiIKadri')
  })

  it('повторное нажатие закрывает открытый раздел и уходит на главную, если вкладок не осталось', () => {
    useWorkspaceTabsStore.setState({
      tabs: [tab({})],
      activeTabId: '/modules/ZarplatiIKadri',
    })

    performSectionToggle(
      '/modules/ZarplatiIKadri',
      '/modules/ZarplatiIKadri',
      navigate
    )

    expect(useWorkspaceTabsStore.getState().tabs).toHaveLength(0)
    expect(navigate).toHaveBeenCalledWith('/')
  })

  it('повторное нажатие закрывает раздел и возвращает на соседнюю вкладку', () => {
    useWorkspaceTabsStore.setState({
      tabs: [
        tab({
          id: '/modules/Bank',
          path: '/modules/Bank',
          title: 'Банк и касса',
          createdAt: 0,
        }),
        tab({}),
      ],
      activeTabId: '/modules/ZarplatiIKadri',
      activationOrder: ['/modules/Bank', '/modules/ZarplatiIKadri'],
    })

    performSectionToggle(
      '/modules/ZarplatiIKadri',
      '/modules/ZarplatiIKadri',
      navigate
    )

    expect(useWorkspaceTabsStore.getState().tabs.map((t) => t.id)).toEqual([
      '/modules/Bank',
    ])
    expect(navigate).toHaveBeenCalledWith('/modules/Bank')
  })

  it('из документа внутри раздела нажатие открывает сам раздел, вкладки не закрываются', () => {
    useWorkspaceTabsStore.setState({
      tabs: [tab({ id: 'doc', path: '/modules/ZarplatiIKadri/document/X' })],
      activeTabId: 'doc',
    })

    performSectionToggle(
      '/modules/ZarplatiIKadri',
      '/modules/ZarplatiIKadri/document/X',
      navigate
    )

    expect(useWorkspaceTabsStore.getState().tabs).toHaveLength(1)
    expect(navigate).toHaveBeenCalledWith('/modules/ZarplatiIKadri')
  })

  it('поверх раздела открыта панельная вкладка — раздел не закрывается', () => {
    useWorkspaceTabsStore.setState({
      tabs: [
        tab({}),
        tab({ id: 'p', path: '', pageType: 'sdui-panel', panelId: 'p-1' }),
      ],
      activeTabId: 'p',
    })

    performSectionToggle(
      '/modules/ZarplatiIKadri',
      '/modules/ZarplatiIKadri',
      navigate
    )

    expect(useWorkspaceTabsStore.getState().tabs).toHaveLength(2)
    expect(navigate).toHaveBeenCalledWith('/modules/ZarplatiIKadri')
  })

  it('главная не переключается', () => {
    performSectionToggle('/', '/', navigate)

    expect(navigate).toHaveBeenCalledWith('/')
  })
})
