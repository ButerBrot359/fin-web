import { create } from 'zustand'

import type { DictSidebarPanel } from '../../types/dict-sidebar'

interface DictSidebarStore {
  stack: DictSidebarPanel[]
  push: (panel: Omit<DictSidebarPanel, 'id'>) => void
  pop: () => void
  closeAll: () => void
}

export const useDictSidebarStore = create<DictSidebarStore>((set) => ({
  stack: [],
  push: (panel) => {
    set((state) => ({
      stack: [...state.stack, { ...panel, id: crypto.randomUUID() }],
    }))
  },
  pop: () => {
    set((state) => ({
      stack: state.stack.slice(0, -1),
    }))
  },
  closeAll: () => {
    set({ stack: [] })
  },
}))
