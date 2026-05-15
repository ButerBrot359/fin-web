import { create } from 'zustand'

interface LoaderStore {
  activeCount: number
  increment: () => void
  decrement: () => void
}

export const useLoaderStore = create<LoaderStore>((set) => ({
  activeCount: 0,
  increment: () =>
    set((state) => ({ activeCount: state.activeCount + 1 })),
  decrement: () =>
    set((state) => ({ activeCount: Math.max(0, state.activeCount - 1) })),
}))
