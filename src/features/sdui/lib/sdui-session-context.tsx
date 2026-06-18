import { createContext, useContext, type ReactNode } from 'react'

import type { ViewNode, ViewPatch } from '../types/view'
import { useTreeStore } from './stores/tree-store'
import { useViewStateStore } from './stores/view-state-store'

export interface SduiSessionValue {
  formSessionId: string | null
  revision: number | null
  getValue: (binding: string | undefined) => unknown
  setValue: (binding: string, value: unknown) => void
  setFromServer: (binding: string, value: unknown) => void
  getAll: () => Record<string, unknown>
  replaceAll: (state: Record<string, unknown>) => void
  merge: (patch: Record<string, unknown>) => void
  isDirty: boolean
  resetDirty: () => void
  tree: ViewNode | null
  setRoot: (node: ViewNode) => void
  setSession: (id: string, rev: number) => void
  bumpRevision: (rev: number) => void
  applyTreePatches: (patches: ViewPatch[]) => void
  clearAllErrors: () => void
}

const SduiSessionContext = createContext<SduiSessionValue | null>(null)

export const useSduiSession = (): SduiSessionValue => {
  const ctx = useContext(SduiSessionContext)
  // Unconditional hook calls (React rules) — used only in fallback path
  const tree = useTreeStore((s) => s.root)
  const dirty = useViewStateStore((s) => s.dirty)

  if (ctx) return ctx

  // Fallback: global stores (for components outside provider, e.g. SduiScreen itself)
  return {
    formSessionId: useTreeStore.getState().formSessionId,
    revision: useTreeStore.getState().revision,
    getValue: (binding) =>
      binding ? useViewStateStore.getState().state[binding] : undefined,
    setValue: useViewStateStore.getState().set,
    setFromServer: useViewStateStore.getState().setFromServer,
    getAll: useViewStateStore.getState().getAll,
    replaceAll: useViewStateStore.getState().replaceAll,
    merge: useViewStateStore.getState().merge,
    isDirty: dirty,
    resetDirty: useViewStateStore.getState().resetDirty,
    tree,
    setRoot: useTreeStore.getState().setRoot,
    setSession: useTreeStore.getState().setSession,
    bumpRevision: useTreeStore.getState().bumpRevision,
    applyTreePatches: useTreeStore.getState().applyPatches,
    clearAllErrors: useTreeStore.getState().clearAllErrors,
  }
}

interface SduiSessionProviderProps {
  value: SduiSessionValue
  children: ReactNode
}

export const SduiSessionProvider = ({
  value,
  children,
}: SduiSessionProviderProps) => (
  <SduiSessionContext value={value}>{children}</SduiSessionContext>
)
