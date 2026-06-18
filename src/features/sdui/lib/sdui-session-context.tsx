import { createContext, useContext, type ReactNode } from 'react'

import type { ViewNode, ViewPatch } from '../types/view'

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
  if (!ctx)
    throw new Error('useSduiSession must be used within SduiSessionProvider')
  return ctx
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
