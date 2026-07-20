import { create } from 'zustand'

import { applyPatches, clearErrors } from '../patch-applier'
import type { ViewNode, ViewNodeAction, ViewPatch } from '../../types/view'

interface TreeStoreState {
  root: ViewNode | null
  formSessionId: string | null
  revision: number | null
  // Дескриптор «закрыть грязную вкладку» с OPEN (SCRUM-283)
  onDirtyClose: ViewNodeAction | null

  setRoot: (node: ViewNode) => void
  setSession: (id: string, rev: number) => void
  bumpRevision: (rev: number) => void
  setOnDirtyClose: (desc: ViewNodeAction | null) => void
  applyPatches: (patches: ViewPatch[]) => void
  clearAllErrors: () => void
  reset: () => void
}

export const useTreeStore = create<TreeStoreState>((set, get) => ({
  root: null,
  formSessionId: null,
  revision: null,
  onDirtyClose: null,

  setRoot: (node) => set({ root: node }),

  setOnDirtyClose: (desc) => set({ onDirtyClose: desc }),

  setSession: (id, rev) => set({ formSessionId: id, revision: rev }),

  bumpRevision: (rev) => set({ revision: rev }),

  applyPatches: (patches) => {
    const { root } = get()
    if (!root) return
    set({ root: applyPatches(root, patches) })
  },

  clearAllErrors: () => {
    const { root } = get()
    if (!root) return
    set({ root: clearErrors(root) })
  },

  reset: () =>
    set({ root: null, formSessionId: null, revision: null, onDirtyClose: null }),
}))
