import { showToast } from '@/shared/ui/toast/show-toast'

import type { ConflictError, ViewAction } from '../types/view'
import { useTreeStore } from './stores/tree-store'
import { useViewStateStore } from './stores/view-state-store'

export function handleConflict(
  err: ConflictError,
  _originalAction: ViewAction,
  reopen: () => Promise<void>,
): void {
  if (err.code === 'STALE_REVISION') {
    showToast('info', 'Синхронизирую...')
    if (err.formSessionId && err.currentRevision != null) {
      useTreeStore.getState().setSession(err.formSessionId, err.currentRevision)
    }
    if (err.snapshot?.state) {
      useViewStateStore.getState().replaceAll(err.snapshot.state)
    }
  } else if (err.code === 'SESSION_NOT_FOUND') {
    showToast('warning', 'Сессия истекла, переоткрываю...')
    void reopen()
  }
}
