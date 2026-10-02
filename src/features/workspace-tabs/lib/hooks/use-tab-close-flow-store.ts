import { create } from 'zustand'

export type TabCloseFlowMode = 'single' | 'all'

interface TabCloseFlowStore {
  mode: TabCloseFlowMode | null
  queue: string[]
  savingTabId: string | null
  start: (mode: TabCloseFlowMode, tabIds: string[]) => void
  advance: () => void
  setSaving: (tabId: string | null) => void
  cancel: () => void
}

export const useTabCloseFlowStore = create<TabCloseFlowStore>((set) => ({
  mode: null,
  queue: [],
  savingTabId: null,
  start: (mode, tabIds) => {
    set({ mode, queue: tabIds, savingTabId: null })
  },
  advance: () => {
    set((s) => ({ queue: s.queue.slice(1), savingTabId: null }))
  },
  setSaving: (tabId) => {
    set({ savingTabId: tabId })
  },
  cancel: () => {
    set({ mode: null, queue: [], savingTabId: null })
  },
}))
