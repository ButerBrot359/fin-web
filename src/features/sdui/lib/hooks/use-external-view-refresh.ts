import { useEffect, useRef } from 'react'

import { registerOpenViewsRefresh } from '@/shared/lib/refresh/open-views-refresh'

import type { useSduiDispatch } from '../dispatch'
import { viewTransport } from '../../api/view-transport'
import { hasPendingTableCommits } from '../pending-table-commits'
import { useCommandInflightStore } from '../stores/command-inflight-store'
import { usePanelStore } from '../stores/panel-store'
import { useSduiCacheStore } from '../stores/sdui-cache-store'
import { useTreeStore } from '../stores/tree-store'
import { useViewStateStore } from '../stores/view-state-store'
import type { ViewTabMeta } from '../../types/view'

type Dispatch = ReturnType<typeof useSduiDispatch>

function closeSession(formSessionId: string): void {
  void viewTransport
    .post({ formSessionId, action: { type: 'CLOSE' } })
    .catch(() => undefined)
}

function hasUnsavedWork(): boolean {
  const sid = useTreeStore.getState().formSessionId
  return (
    useViewStateStore.getState().dirty ||
    hasPendingTableCommits() ||
    (sid != null && sid in useCommandInflightStore.getState().sessions) ||
    // A picker/editor can hold input in its own state, outside the root form.
    usePanelStore.getState().panels.some((panel) => !panel.openInWorkspaceTab)
  )
}

/** React Query invalidation alone cannot replace an SDUI tree/form-session. */
export function useExternalViewRefresh(
  route: string,
  dispatch: Dispatch,
  onTab?: (tab: ViewTabMeta | null) => void
): void {
  const callbacks = useRef({ dispatch, onTab })
  callbacks.current = { dispatch, onTab }

  useEffect(() => {
    let active = true
    let inFlight = false
    let queued = false
    let scheduled = false
    const schedule = () => {
      if (scheduled || !queued || !active) return
      scheduled = true
      queueMicrotask(() => {
        scheduled = false
        if (
          queued &&
          active &&
          !inFlight &&
          !hasUnsavedWork() &&
          useTreeStore.getState().root
        ) {
          queued = false
          void refresh()
        }
      })
    }
    const refresh = async () => {
      const result = { refreshed: 0, deferred: 0, failed: 0 }
      const original = useTreeStore.getState()
      const values = useViewStateStore.getState().state

      // Hidden dirty tabs keep their snapshots. Clean tabs must reopen from DB.
      const cache = useSduiCacheStore.getState()
      const cacheRoute = route.split('?')[0]
      for (const [cachedRoute, entry] of Object.entries(cache.cache)) {
        if (cachedRoute === cacheRoute) continue
        if (entry.dirty) {
          result.deferred++
          continue
        }
        cache.remove(cachedRoute)
        if (
          entry.formSessionId &&
          entry.formSessionId !== original.formSessionId
        ) {
          closeSession(entry.formSessionId)
        }
      }

      if (!original.root || inFlight || hasUnsavedWork()) {
        queued = true
        result.deferred++
        return result
      }
      const unchanged = () =>
        active &&
        useTreeStore.getState().formSessionId === original.formSessionId &&
        useTreeStore.getState().revision === original.revision &&
        useTreeStore.getState().root === original.root &&
        useViewStateStore.getState().state === values &&
        !hasUnsavedWork()

      inFlight = true
      try {
        const ok = await callbacks.current.dispatch(
          { type: 'OPEN' },
          null,
          false,
          {
            freshOpen: true,
            acceptOpenResponse: unchanged,
            onOpenTab: (tab) => callbacks.current.onTab?.(tab),
          }
        )
        if (ok) {
          useSduiCacheStore.getState().remove(cacheRoute)
          if (
            original.formSessionId &&
            original.formSessionId !== useTreeStore.getState().formSessionId
          ) {
            closeSession(original.formSessionId)
          }
          result.refreshed++
        } else if (!unchanged()) {
          queued = active
          result.deferred++
        } else {
          result.failed++
        }
      } catch {
        result.failed++
      } finally {
        inFlight = false
        schedule()
      }
      return result
    }
    const unregister = registerOpenViewsRefresh(refresh)
    // Retry only after an actual local state transition, never on a timer.
    // A dirty draft queues refresh until its save/discard; failed OPEN is not retried.
    const subscriptions = [
      useTreeStore,
      useViewStateStore,
      usePanelStore,
      useCommandInflightStore,
    ].map((store) => store.subscribe(schedule))
    return () => {
      active = false
      unregister()
      subscriptions.forEach((unsubscribe) => {
        unsubscribe()
      })
    }
  }, [route])
}
