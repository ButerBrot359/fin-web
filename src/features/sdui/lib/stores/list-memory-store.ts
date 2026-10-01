import { create } from 'zustand'

import type { ListTrailEntry } from '../../ui/nodes/composite/list-breadcrumbs'

export interface ListMemoryEntry {
  search: string
  selectedRowId: number | null
  trail: ListTrailEntry[]
}

interface ListMemoryStore {
  entries: Partial<Record<string, Record<string, ListMemoryEntry>>>
  get: (route: string, nodeId: string) => ListMemoryEntry | undefined
  save: (route: string, nodeId: string, entry: ListMemoryEntry) => void
  forgetRoute: (route: string) => void
}

export const useListMemoryStore = create<ListMemoryStore>((set, get) => ({
  entries: {},
  get: (route, nodeId) => get().entries[route]?.[nodeId],
  save: (route, nodeId, entry) => {
    set((s) => ({
      entries: {
        ...s.entries,
        [route]: { ...s.entries[route], [nodeId]: entry },
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

export function forgetListMemory(route: string): void {
  useListMemoryStore.getState().forgetRoute(route)
}
