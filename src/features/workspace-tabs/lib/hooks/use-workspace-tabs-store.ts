import { create } from 'zustand'

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

export const useWorkspaceTabsStore = create<WorkspaceTabsStore>((set, get) => ({
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
}))
