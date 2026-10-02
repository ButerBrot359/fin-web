import { useEffect } from 'react'

import { viewTransport } from '../../api/view-transport'
import { hasPendingTableCommits } from '../pending-table-commits'
import { useSduiCacheStore } from '../stores/sdui-cache-store'
import { useTreeStore } from '../stores/tree-store'
import { useViewStateStore } from '../stores/view-state-store'

export function hasUnsavedScreenWork(): boolean {
  return (
    useViewStateStore.getState().dirty ||
    hasPendingTableCommits() ||
    Object.values(useSduiCacheStore.getState().cache).some((c) => c.dirty)
  )
}

export function useUnloadGuard(): void {
  useEffect(() => {
    const warnUnsaved = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedScreenWork()) return
      e.preventDefault()
    }
    const closeOnUnload = () => {
      const sid = useTreeStore.getState().formSessionId
      if (sid) viewTransport.closeBeacon(sid)
      for (const entry of Object.values(useSduiCacheStore.getState().cache)) {
        if (entry.formSessionId && entry.formSessionId !== sid) {
          viewTransport.closeBeacon(entry.formSessionId)
        }
      }
    }
    window.addEventListener('beforeunload', warnUnsaved)
    window.addEventListener('pagehide', closeOnUnload)
    return () => {
      window.removeEventListener('beforeunload', warnUnsaved)
      window.removeEventListener('pagehide', closeOnUnload)
    }
  }, [])
}
