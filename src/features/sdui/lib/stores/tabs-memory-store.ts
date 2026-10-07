import { create } from 'zustand'

interface TabsMemoryStore {
  entries: Partial<Record<string, Record<string, string>>>
  get: (route: string, tabsNodeId: string) => string | undefined
  save: (route: string, tabsNodeId: string, activeTabId: string) => void
  forgetRoute: (route: string) => void
}

export const useTabsMemoryStore = create<TabsMemoryStore>((set, get) => ({
  entries: {},
  get: (route, tabsNodeId) => get().entries[route]?.[tabsNodeId],
  save: (route, tabsNodeId, activeTabId) => {
    set((s) => ({
      entries: {
        ...s.entries,
        [route]: { ...s.entries[route], [tabsNodeId]: activeTabId },
      },
    }))
  },
  forgetRoute: (route) => {
    set((s) => {
      if (!(route in s.entries)) return s
      const { [route]: _, ...rest } = s.entries
      return { entries: rest }
    })
  },
}))

export function forgetTabsMemory(route: string): void {
  useTabsMemoryStore.getState().forgetRoute(route)
}
