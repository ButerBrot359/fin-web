import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  MemoryRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom'

import { useWorkspaceTabsStore } from '@/features/workspace-tabs'

import { WorkspaceTabSync } from './workspace-tab-sync'

// Сценарий бага: «Создать на основании» уходит на плоский /documents/:type/new,
// оттуда DocumentRedirect делает REPLACE в /modules/:pageCode/document/:type/new.
// Без флага REPLACE переписывал путь АКТИВНОЙ вкладки — вкладка документа-основания
// превращалась в приёмник и пропадала из панели.

const BASIS_PATH = '/modules/gp/document/ZayavkaGP/27856789'
const FLAT_ROUTE = '/documents/SchetKOplate/new?basisId=27856789'
const TARGET_PATH = '/modules/gp/document/SchetKOplate/new'

const CreateBasedOnButton = ({ newTab }: { newTab: boolean }) => {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => {
        if (newTab) useWorkspaceTabsStore.getState().armNewTab()
        void navigate(FLAT_ROUTE)
      }}
    >
      создать на основании
    </button>
  )
}

function renderApp(newTab: boolean) {
  return render(
    <MemoryRouter initialEntries={[BASIS_PATH]}>
      <WorkspaceTabSync />
      <Routes>
        <Route path={BASIS_PATH} element={<CreateBasedOnButton newTab={newTab} />} />
        <Route
          path="/documents/:typeCode/new"
          element={<Navigate to={`${TARGET_PATH}?basisId=27856789`} replace />}
        />
        <Route path={TARGET_PATH} element={<div>счёт на оплате</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  cleanup()
  sessionStorage.clear()
  useWorkspaceTabsStore.setState({
    tabs: [],
    activeTabId: null,
    forceNewTab: false,
  })
})

describe('WorkspaceTabSync — navigate с openInNewTab', () => {
  it('вкладка-основание остаётся, новая становится активной', () => {
    renderApp(true)
    expect(useWorkspaceTabsStore.getState().tabs).toHaveLength(1)

    fireEvent.click(screen.getByText('создать на основании'))

    const { tabs, activeTabId, forceNewTab } = useWorkspaceTabsStore.getState()
    expect(tabs.map((t) => t.path)).toEqual([BASIS_PATH, TARGET_PATH])
    expect(activeTabId).toBe(TARGET_PATH)
    // Флаг одноразовый: следующий редирект снова работает как раньше
    expect(forceNewTab).toBe(false)
    // search цели сохранён — по нему форма знает основание
    expect(tabs[1].search).toBe('?basisId=27856789')
  })

  it('регресс без флага: редирект по-прежнему переписывает активную вкладку', () => {
    renderApp(false)

    fireEvent.click(screen.getByText('создать на основании'))

    const { tabs } = useWorkspaceTabsStore.getState()
    expect(tabs).toHaveLength(1)
    expect(tabs[0].path).toBe(TARGET_PATH)
  })
})
