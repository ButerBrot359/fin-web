import { useEffect } from 'react'

import type { useSduiDispatch } from '../dispatch'
import { useTreeStore } from '../stores/tree-store'

interface PendingSaveAndCloseOptions {
  screenRoute: string
  dispatch: ReturnType<typeof useSduiDispatch>
  pendingAction?: string | null
  consumePendingAction?: (route: string) => string | null
  onSavedAndClosed?: (route: string) => void
  onSaveAndCloseFailed?: (route: string) => void
}

export function usePendingSaveAndClose({
  screenRoute,
  dispatch,
  pendingAction,
  consumePendingAction,
  onSavedAndClosed,
  onSaveAndCloseFailed,
}: PendingSaveAndCloseOptions): void {
  const tree = useTreeStore((s) => s.root)
  const onDirtyClose = useTreeStore((s) => s.onDirtyClose)

  useEffect(() => {
    const route = screenRoute
    const { root, onDirtyClose: desc } = useTreeStore.getState()
    if (!root) return
    const pending = consumePendingAction?.(route)
    if (pending !== 'save-and-close') return
    // Имя команды и её поведение — из серверного дескриптора, не хардкод (§4.5)
    if (!desc?.command) {
      onSaveAndCloseFailed?.(route)
      return
    }
    void dispatch(
      { type: 'COMMAND', command: desc.command },
      desc.behavior
    ).then((ok) => {
      if (!ok) {
        onSaveAndCloseFailed?.(route)
        return
      }
      onSavedAndClosed?.(route)
    })
  }, [
    screenRoute,
    tree,
    onDirtyClose,
    pendingAction,
    dispatch,
    consumePendingAction,
    onSavedAndClosed,
    onSaveAndCloseFailed,
  ])
}
