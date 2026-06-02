import { create } from 'zustand'

interface ViewStateStoreState {
  state: Record<string, unknown>
  get: (binding: string) => unknown
  set: (binding: string, value: unknown) => void
  merge: (patch: Record<string, unknown>) => void
  replaceAll: (s: Record<string, unknown>) => void
  getAll: () => Record<string, unknown>
}

export const useViewStateStore = create<ViewStateStoreState>((set, get) => ({
  state: {},
  get: (binding) => get().state[binding],
  set: (binding, value) =>
    set((s) => ({ state: { ...s.state, [binding]: value } })),
  merge: (patch) => set((s) => ({ state: { ...s.state, ...patch } })),
  replaceAll: (s) => set({ state: s }),
  getAll: () => get().state,
}))

export const useViewState = (binding: string | undefined) =>
  useViewStateStore((s) => (binding ? s.state[binding] : undefined))

export const useViewStateSetter = () => useViewStateStore((s) => s.set)
