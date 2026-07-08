import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

import { MAX_TABS } from '../consts/workspace-tabs-config'
import type { WorkspaceTab, TabPageType } from '../../types/workspace-tab'

interface WorkspaceTabsStore {
  tabs: WorkspaceTab[]
  activeTabId: string | null

  activateOrCreate: (
    path: string,
    search: string,
    pageType: TabPageType
  ) => string | null
  activateOrCreatePanel: (id: string, title: string, panelId: string) => void
  closeTab: (tabId: string) => WorkspaceTab | undefined
  setActiveTab: (tabId: string) => void
  setTabTitle: (tabId: string, title: string) => void
  updateTabPath: (tabId: string, path: string, search: string) => void
}

function updateTab(
  tabs: WorkspaceTab[],
  tabId: string,
  updater: (tab: WorkspaceTab) => WorkspaceTab
): WorkspaceTab[] {
  return tabs.map((t) => (t.id === tabId ? updater(t) : t))
}

export const useWorkspaceTabsStore = create<WorkspaceTabsStore>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,

      activateOrCreate: (path, search, pageType) => {
        if (path === '/') return null

        const { tabs } = get()

        const existing = tabs.find((t) => t.path === path)
        if (existing) {
          set({
            activeTabId: existing.id,
            tabs: updateTab(tabs, existing.id, (t) => ({ ...t, search })),
          })
          return existing.id
        }

        const id = path

        const tab: WorkspaceTab = {
          id,
          path,
          search,
          title: '',
          pageType,
          createdAt: Date.now(),
        }

        let newTabs = [...tabs, tab]
        if (newTabs.length > MAX_TABS) {
          newTabs = [newTabs[0], ...newTabs.slice(2)]
        }

        set({ tabs: newTabs, activeTabId: id })
        return id
      },

      // Панельная вкладка (sdui-panel): не маршрутная, id = стабильный tabKey.
      // Повторный вызов с тем же id переиспользует вкладку (обновляя panelId).
      activateOrCreatePanel: (id, title, panelId) => {
        const { tabs } = get()

        const existing = tabs.find((t) => t.id === id)
        if (existing) {
          set({
            activeTabId: existing.id,
            tabs: updateTab(tabs, existing.id, (t) => ({ ...t, title, panelId })),
          })
          return
        }

        const tab: WorkspaceTab = {
          id,
          path: '',
          search: '',
          title,
          pageType: 'sdui-panel',
          panelId,
          createdAt: Date.now(),
        }

        let newTabs = [...tabs, tab]
        if (newTabs.length > MAX_TABS) {
          newTabs = [newTabs[0], ...newTabs.slice(2)]
        }

        set({ tabs: newTabs, activeTabId: id })
      },

      closeTab: (tabId) => {
        const { tabs, activeTabId } = get()
        const idx = tabs.findIndex((t) => t.id === tabId)
        if (idx === -1) return undefined

        const closed = tabs[idx]
        const newTabs = tabs.filter((t) => t.id !== tabId)

        let newActiveId = activeTabId
        if (activeTabId === tabId) {
          const neighbor = newTabs.at(idx) ?? newTabs.at(idx - 1)
          newActiveId = neighbor ? neighbor.id : null
        }

        set({ tabs: newTabs, activeTabId: newActiveId })
        return closed
      },

      setActiveTab: (tabId) => {
        set({ activeTabId: tabId })
      },

      setTabTitle: (tabId, title) => {
        set((state) => ({
          tabs: updateTab(state.tabs, tabId, (t) => ({ ...t, title })),
        }))
      },

      updateTabPath: (tabId, path, search) => {
        set((state) => ({
          tabs: updateTab(state.tabs, tabId, (t) => ({
            ...t,
            id: path,
            path,
            search,
          })),
          activeTabId: state.activeTabId === tabId ? path : state.activeTabId,
        }))
      },
    }),
    {
      name: 'workspace-tabs',
      storage: createJSONStorage(() => sessionStorage),
      // Панельные вкладки не персистим: их контент — in-memory panel-store SDUI,
      // перезагрузку не переживает (иначе после reload осиротевшая вкладка).
      partialize: (state) => {
        const tabs = state.tabs.filter((t) => t.pageType !== 'sdui-panel')
        return {
          tabs,
          activeTabId: tabs.some((t) => t.id === state.activeTabId)
            ? state.activeTabId
            : null,
        }
      },
    }
  )
)
