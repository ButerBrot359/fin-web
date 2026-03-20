import { create } from 'zustand'

import type { DictSidebarPanel } from '../../types/dict-sidebar'

interface DictSidebarStore {
  stack: DictSidebarPanel[]
  push: (panel: Omit<DictSidebarPanel, 'id'>) => void
  pop: () => void
  closeAll: () => void
  updateTopTitle: (title: string) => void
}

export const useDictSidebarStore = create<DictSidebarStore>((set) => ({
  stack: [],
  push: (panel) => {
    set((state) => ({
      // TODO: перейти на crypto.randomUUID() после переезда на HTTPS
      // stack: [...state.stack, { ...panel, id: crypto.randomUUID() }],
      stack: [
        ...state.stack,
        {
          ...panel,
          id: Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join(''),
        },
      ],
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
  updateTopTitle: (title) => {
    set((state) => {
      if (state.stack.length === 0) return state
      const updated = [...state.stack]
      updated[updated.length - 1] = { ...updated[updated.length - 1], title }
      return { stack: updated }
    })
  },
}))
