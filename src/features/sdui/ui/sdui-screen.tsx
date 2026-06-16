import { useEffect, type FC } from 'react'
import { useLocation } from 'react-router-dom'

import { PageSkeleton } from '@/shared/ui/page-skeleton/page-skeleton'
import { useTabMeta, useWorkspaceTabsStore } from '@/features/workspace-tabs'

import { useTreeStore } from '../lib/stores/tree-store'
import { useViewStateStore } from '../lib/stores/view-state-store'
import { useSduiCacheStore } from '../lib/stores/sdui-cache-store'
import { viewTransport } from '../api/view-transport'
import { useSduiDispatch } from '../lib/dispatch'
import { NodeRenderer } from './node-renderer'
import { DialogHost } from './dialog-host'

interface SduiScreenProps {
  layoutCode?: string
}

export const SduiScreen: FC<SduiScreenProps> = ({ layoutCode }) => {
  const location = useLocation()
  const tree = useTreeStore((s) => s.root)
  const reset = useTreeStore((s) => s.reset)
  const dispatch = useSduiDispatch()


  useTabMeta((tree?.props?.title as string | undefined) ?? '')

  useEffect(() => {
    const route = location.pathname

    // Восстановление из кэша рабочей вкладки (если возвращаемся на уже открытый
    // документ) — без повторного OPEN: серверная form-session ещё жива.
    const cached = useSduiCacheStore.getState().get(route)
    if (cached) {
      useTreeStore.getState().setRoot(cached.root)
      if (cached.formSessionId != null && cached.revision != null) {
        useTreeStore.getState().setSession(cached.formSessionId, cached.revision)
      }
      useViewStateStore.getState().replaceAll(cached.viewState)
    } else {
      void dispatch({ type: 'OPEN', layoutCode })
    }

    return () => {
      const tabStillExists = useWorkspaceTabsStore
        .getState()
        .tabs.some((tab) => tab.id === route)
      const treeState = useTreeStore.getState()

      if (tabStillExists && treeState.root) {
        useSduiCacheStore.getState().save(route, {
          root: treeState.root,
          formSessionId: treeState.formSessionId,
          revision: treeState.revision,
          viewState: useViewStateStore.getState().getAll(),
        })
      } else {
        void dispatch({ type: 'CLOSE' })
        useSduiCacheStore.getState().remove(route)
      }
      reset()
    }
  }, [location.pathname])

  useEffect(() => {
    const handler = () => {
      const sid = useTreeStore.getState().formSessionId
      if (sid) viewTransport.closeBeacon(sid)
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  if (!tree) return <PageSkeleton />

  return (
    <>
      <NodeRenderer node={tree} />
      <DialogHost />
    </>
  )
}
