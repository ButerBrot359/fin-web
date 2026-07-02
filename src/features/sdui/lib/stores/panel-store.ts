import { create } from 'zustand'

import type { ViewNode } from '../../types/view'

export interface PanelEntry {
  panelId: string
  node: ViewNode
  presentation: 'drawer' | 'modal' | 'page'
  session?: {
    formSessionId: string
    revision: number
    parentSessionId?: string
    targetNodeId?: string
  }
  viewState: Record<string, unknown>
}

interface PanelStore {
  panels: PanelEntry[]
  push: (p: PanelEntry) => void
  pop: () => void
  remove: (panelId: string) => void
  updateSession: (panelId: string, revision: number) => void
  findBySessionId: (sessionId: string) => PanelEntry | undefined
  reset: () => void
}

export const usePanelStore = create<PanelStore>((set, get) => ({
  panels: [],
  push: (p) => set((s) => ({ panels: [...s.panels, p] })),
  pop: () => set((s) => ({ panels: s.panels.slice(0, -1) })),
  remove: (panelId) =>
    set((s) => ({ panels: s.panels.filter((p) => p.panelId !== panelId) })),
  updateSession: (panelId, revision) =>
    set((s) => ({
      panels: s.panels.map((p) =>
        p.panelId === panelId && p.session
          ? { ...p, session: { ...p.session, revision } }
          : p,
      ),
    })),
  findBySessionId: (sessionId) =>
    get().panels.find((p) => p.session?.formSessionId === sessionId),
  reset: () => set({ panels: [] }),
}))
