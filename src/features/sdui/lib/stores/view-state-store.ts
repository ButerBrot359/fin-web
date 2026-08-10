import { create } from 'zustand'

interface ViewStateStoreState {
  state: Record<string, unknown>
  dirty: boolean
  get: (binding: string) => unknown
  set: (binding: string, value: unknown) => void
  setFromServer: (binding: string, value: unknown) => void
  merge: (patch: Record<string, unknown>) => void
  replaceAll: (s: Record<string, unknown>) => void
  getAll: () => Record<string, unknown>
  resetDirty: () => void
  // Авторитетный dirty от сервера (SCRUM-288 §2.5): в отличие от resetDirty
  // (только сброс в false), позволяет выставить любое значение флага.
  setDirty: (value: boolean) => void
}

export const useViewStateStore = create<ViewStateStoreState>((set, get) => ({
  state: {},
  dirty: false,
  get: (binding) => get().state[binding],
  set: (binding, value) => {
    set((s) => ({ state: { ...s.state, [binding]: value }, dirty: true }))
  },
  setFromServer: (binding, value) => {
    set((s) => ({ state: { ...s.state, [binding]: value } }))
  },
  merge: (patch) => {
    set((s) => ({ state: { ...s.state, ...patch } }))
  },
  replaceAll: (s) => {
    set({ state: s, dirty: false })
  },
  getAll: () => get().state,
  resetDirty: () => {
    set({ dirty: false })
  },
  setDirty: (value) => {
    set({ dirty: value })
  },
}))
