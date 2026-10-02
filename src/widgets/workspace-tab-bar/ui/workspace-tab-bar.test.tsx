import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  notifyTabSaveFailed,
  onPanelTabClose,
  onTabDiscardClose,
  setTabLeaveFlush,
  useFormCacheStore,
  useTabCloseFlowStore,
  useWorkspaceTabsStore,
} from '@/features/workspace-tabs'

import { WorkspaceTabBar } from './workspace-tab-bar'

vi.mock('@/shared/assets/icons/cross.svg', () => ({
  default: () => null,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const LocationProbe = () => {
  const location = useLocation()
  return <div data-testid="loc">{location.pathname}</div>
}

const formTab = {
  id: '/documents/42',
  path: '/documents/42',
  search: '',
  title: 'Документ 42',
  pageType: 'document-entry' as const,
  createdAt: 1,
}

const panelTab = {
  id: 'movements:42',
  path: '',
  search: '',
  title: 'Движения 42',
  pageType: 'sdui-panel' as const,
  panelId: 'p-42',
  createdAt: 2,
}

const formTab2 = {
  id: '/documents/99',
  path: '/documents/99',
  search: '',
  title: 'Документ 99',
  pageType: 'document-entry' as const,
  createdAt: 3,
}

const renderBar = () =>
  render(
    <MemoryRouter initialEntries={['/documents/42']}>
      <WorkspaceTabBar />
      <LocationProbe />
    </MemoryRouter>
  )

describe('WorkspaceTabBar: navigateAfterClose — активный таб из стора', () => {
  beforeEach(() => {
    sessionStorage.clear()
    // tabs[0]=formTab, tabs[1]=formTab2 (active), tabs[2]=panelTab
    // При закрытии formTab2 (idx=1) стор активирует panelTab (newTabs.at(1)=panelTab)
    // Старый код взял бы tabs[0]=formTab — это баг, фикс берёт стор activeTabId
    useWorkspaceTabsStore.setState({
      tabs: [formTab, formTab2, panelTab],
      activeTabId: formTab2.id,
    })
  })
  afterEach(cleanup)

  it('закрытие активного таба навигирует к tabId из стора, а не к tabs[0]', () => {
    renderBar()
    const tabButton = screen.getByText('Документ 99').closest('button')!
    fireEvent.click(within(tabButton).getByRole('button'))

    // Стор должен был активировать panelTab (сосед справа после удаления)
    expect(useWorkspaceTabsStore.getState().activeTabId).toBe(panelTab.id)
    // URL не должен был измениться (panelTab — sdui-panel, без навигации)
    expect(screen.getByTestId('loc').textContent).toBe('/documents/42')
    // И tabs[0] (formTab) не должен был стать activeTabId
    expect(useWorkspaceTabsStore.getState().activeTabId).not.toBe(formTab.id)
  })
})

describe('WorkspaceTabBar: панельные вкладки', () => {
  beforeEach(() => {
    sessionStorage.clear()
    useWorkspaceTabsStore.setState({
      tabs: [formTab, panelTab],
      activeTabId: formTab.id,
    })
  })
  afterEach(cleanup)

  it('активация панельной вкладки не навигирует', () => {
    renderBar()
    fireEvent.click(screen.getByText('Движения 42'))
    expect(useWorkspaceTabsStore.getState().activeTabId).toBe('movements:42')
    expect(screen.getByTestId('loc').textContent).toBe('/documents/42')
  })

  it('закрытие панельной вкладки уведомляет реестр её panelId', () => {
    const onClose = vi.fn()
    const unsubscribe = onPanelTabClose(onClose)
    renderBar()

    // Кнопка-крестик — вложенный span[role=button] внутри кнопки вкладки
    const tabButton = screen.getByText('Движения 42').closest('button')!
    fireEvent.click(within(tabButton).getByRole('button'))

    expect(onClose).toHaveBeenCalledWith('p-42')
    expect(useWorkspaceTabsStore.getState().tabs.map((t) => t.id)).toEqual([
      '/documents/42',
    ])
    unsubscribe()
  })
})

describe('WorkspaceTabBar: «Закрыть все»', () => {
  beforeEach(() => {
    sessionStorage.clear()
    useTabCloseFlowStore.getState().cancel()
    useFormCacheStore.setState({ cache: {}, pendingActions: {} })
    useWorkspaceTabsStore.setState({
      tabs: [formTab, formTab2, panelTab],
      activeTabId: formTab.id,
    })
  })
  afterEach(cleanup)

  it('при одной вкладке кнопки нет', () => {
    useWorkspaceTabsStore.setState({ tabs: [formTab], activeTabId: formTab.id })
    renderBar()
    expect(screen.queryByTestId('workspace-tabs-close-all')).toBeNull()
  })

  it('без изменённых форм закрывает все вкладки сразу и уходит на главную', () => {
    renderBar()
    fireEvent.click(screen.getByTestId('workspace-tabs-close-all'))

    expect(useWorkspaceTabsStore.getState().tabs).toEqual([])
    expect(screen.getByTestId('loc').textContent).toBe('/')
    expect(screen.queryByText('unsavedChangesDialog.title')).toBeNull()
  })

  const formTab3 = {
    id: '/documents/77',
    path: '/documents/77',
    search: '',
    title: 'Документ 77',
    pageType: 'document-entry' as const,
    createdAt: 4,
  }

  const markDirty = (...ids: string[]) => {
    useFormCacheStore.setState({
      cache: Object.fromEntries(
        ids.map((id) => [id, { values: null, isDirty: true }])
      ),
    })
  }

  const asked = () =>
    screen.queryByText(/workspaceTabs\.unsavedTabMessage/) !== null

  it('D11: по каждой изменённой вкладке свой вопрос «Сохранить изменения?»; «Отмена» прерывает закрытие всех', () => {
    useWorkspaceTabsStore.setState({
      tabs: [formTab, formTab2, formTab3, panelTab],
      activeTabId: formTab.id,
    })
    markDirty(formTab2.id, formTab3.id)
    const discarded: string[] = []
    const off = onTabDiscardClose((id) => discarded.push(id))
    renderBar()
    fireEvent.click(screen.getByTestId('workspace-tabs-close-all'))

    expect(screen.getByText('unsavedChangesDialog.title')).toBeTruthy()
    expect(useTabCloseFlowStore.getState().queue[0]).toBe(formTab2.id)
    fireEvent.click(screen.getByText('unsavedChangesDialog.discard'))

    expect(discarded).toEqual([formTab2.id])
    expect(useTabCloseFlowStore.getState().queue).toEqual([formTab3.id])
    expect(asked()).toBe(true)
    fireEvent.click(screen.getByText('actions.cancel'))

    expect(useTabCloseFlowStore.getState().mode).toBeNull()
    expect(useWorkspaceTabsStore.getState().tabs.map((t) => t.id)).toEqual([
      formTab.id,
      formTab3.id,
      panelTab.id,
    ])
    expect(screen.getByTestId('loc').textContent).toBe('/documents/42')
    off()
  })

  it('D11: «Нет» по всем изменённым — черновики сняты, закрыты все, уход на главную', () => {
    useWorkspaceTabsStore.setState({
      tabs: [formTab, formTab2, formTab3, panelTab],
      activeTabId: formTab.id,
    })
    markDirty(formTab2.id, formTab3.id)
    const discarded: string[] = []
    const off = onTabDiscardClose((id) => discarded.push(id))
    renderBar()
    fireEvent.click(screen.getByTestId('workspace-tabs-close-all'))
    fireEvent.click(screen.getByText('unsavedChangesDialog.discard'))
    fireEvent.click(screen.getByText('unsavedChangesDialog.discard'))

    expect(discarded).toEqual([formTab2.id, formTab3.id])
    expect(useWorkspaceTabsStore.getState().tabs).toEqual([])
    expect(screen.getByTestId('loc').textContent).toBe('/')
    off()
  })

  it('D11: «Да» сохраняет вкладку (активация + save-and-close), следующий вопрос — после её закрытия', () => {
    useWorkspaceTabsStore.setState({
      tabs: [formTab, formTab2, formTab3],
      activeTabId: formTab.id,
    })
    markDirty(formTab2.id, formTab3.id)
    renderBar()
    fireEvent.click(screen.getByTestId('workspace-tabs-close-all'))
    fireEvent.click(screen.getByText('unsavedChangesDialog.save'))

    expect(useFormCacheStore.getState().pendingActions[formTab2.id]).toBe(
      'save-and-close'
    )
    expect(useWorkspaceTabsStore.getState().activeTabId).toBe(formTab2.id)
    expect(screen.getByTestId('loc').textContent).toBe('/documents/99')
    expect(useTabCloseFlowStore.getState().savingTabId).toBe(formTab2.id)
    expect(asked()).toBe(false)

    act(() => {
      useFormCacheStore.getState().removeTab(formTab2.id)
      useWorkspaceTabsStore.getState().closeTab(formTab2.id)
    })

    expect(useTabCloseFlowStore.getState().queue).toEqual([formTab3.id])
    expect(asked()).toBe(true)
  })

  it('D11: неудачное сохранение прерывает «Закрыть все»', () => {
    useWorkspaceTabsStore.setState({
      tabs: [formTab, formTab2, formTab3],
      activeTabId: formTab.id,
    })
    markDirty(formTab2.id, formTab3.id)
    renderBar()
    fireEvent.click(screen.getByTestId('workspace-tabs-close-all'))
    fireEvent.click(screen.getByText('unsavedChangesDialog.save'))

    act(() => {
      notifyTabSaveFailed(formTab2.id)
    })

    expect(useTabCloseFlowStore.getState().mode).toBeNull()
    expect(asked()).toBe(false)
    expect(useWorkspaceTabsStore.getState().tabs).toHaveLength(3)
  })
})

describe('WorkspaceTabBar: признак «изменено» после F5 (D5)', () => {
  beforeEach(() => {
    sessionStorage.clear()
    useTabCloseFlowStore.getState().cancel()
    useFormCacheStore.setState({ cache: {}, pendingActions: {} })
    useWorkspaceTabsStore.setState({
      tabs: [formTab, formTab2],
      activeTabId: formTab.id,
    })
  })
  afterEach(cleanup)

  it('неоткрытая вкладка с восстановленным из sessionStorage dirty: звёздочка и вопрос при закрытии; «Да» активирует её с pending save-and-close', async () => {
    sessionStorage.setItem(
      useFormCacheStore.persist.getOptions().name ?? '',
      JSON.stringify({
        state: { cache: { [formTab2.id]: { values: null, isDirty: true } } },
        version: 0,
      })
    )
    await useFormCacheStore.persist.rehydrate()
    renderBar()

    expect(screen.getByText('Документ 99 *')).toBeTruthy()
    const tabButton = screen.getByText('Документ 99 *').closest('button')!
    fireEvent.click(within(tabButton).getByRole('button'))

    expect(screen.getByText('unsavedChangesDialog.title')).toBeTruthy()
    fireEvent.click(screen.getByText('unsavedChangesDialog.save'))

    expect(useFormCacheStore.getState().pendingActions[formTab2.id]).toBe(
      'save-and-close'
    )
    expect(useWorkspaceTabsStore.getState().activeTabId).toBe(formTab2.id)
    expect(screen.getByTestId('loc').textContent).toBe('/documents/99')
    expect(useWorkspaceTabsStore.getState().tabs).toHaveLength(2)
  })
})

describe('WorkspaceTabBar: flush правок перед уходом с вкладки (D7/D8)', () => {
  beforeEach(() => {
    sessionStorage.clear()
    useTabCloseFlowStore.getState().cancel()
    useFormCacheStore.setState({ cache: {}, pendingActions: {} })
    useWorkspaceTabsStore.setState({
      tabs: [formTab, formTab2],
      activeTabId: formTab.id,
    })
  })
  afterEach(cleanup)

  it('переключение и закрытие ждут flush; правка, ставшая dirty во flush, даёт вопрос', async () => {
    let finish: () => void = () => undefined
    const flush = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = () => {
            useFormCacheStore.getState().setDirty(formTab.id, true)
            resolve()
          }
        })
    )
    const off = setTabLeaveFlush({ hasPending: () => true, flush })
    renderBar()

    const tabButton = screen.getByText('Документ 42').closest('button')!
    fireEvent.click(within(tabButton).getByRole('button'))
    expect(flush).toHaveBeenCalledOnce()
    expect(useWorkspaceTabsStore.getState().tabs).toHaveLength(2)

    await act(async () => {
      finish()
      await Promise.resolve()
    })

    expect(screen.getByText('unsavedChangesDialog.title')).toBeTruthy()
    expect(useWorkspaceTabsStore.getState().tabs).toHaveLength(2)
    off()
  })
})
