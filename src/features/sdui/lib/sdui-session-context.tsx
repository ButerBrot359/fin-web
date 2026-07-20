import { createContext, useContext, type ReactNode } from 'react'

import type { ViewNode, ViewNodeAction, ViewPatch } from '../types/view'
import { useTreeStore } from './stores/tree-store'
import { useViewStateStore } from './stores/view-state-store'

export interface SduiSessionValue {
  kind: 'root' | 'panel'
  getSession: () => { formSessionId: string | null; revision: number | null }
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
  // Закрыть текущую сессию: вкладку (root) или панель (panel) — SCRUM-283
  closeAfter?: () => void
  // Сохранить дескриптор «закрыть грязную вкладку» с OPEN — SCRUM-283
  setOnDirtyClose?: (desc: ViewNodeAction | null) => void
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
    kind: 'root',
    getSession: () => {
      const s = useTreeStore.getState()
      return { formSessionId: s.formSessionId, revision: s.revision }
    },
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
    setOnDirtyClose: useTreeStore.getState().setOnDirtyClose,
    applyTreePatches: useTreeStore.getState().applyPatches,
    clearAllErrors: useTreeStore.getState().clearAllErrors,
  }
}

// Точечная подписка на одно значение из view-state.
// Рут: zustand-селектор — нода ре-рендерится только при изменении СВОЕГО значения (фикс M1).
// Панель: локальный useState в PanelFormProvider, читаем через getValue.
export function useBindingValue(binding: string | undefined): unknown {
  const session = useSduiSession()
  // Вызываем безусловно — правила хуков соблюдены.
  const rootValue = useViewStateStore((s) =>
    session.kind === 'root' && binding ? s.state[binding] : undefined,
  )
  if (session.kind === 'root') return rootValue
  return session.getValue(binding)
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
