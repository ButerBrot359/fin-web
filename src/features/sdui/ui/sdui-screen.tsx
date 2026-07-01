import { useEffect, useMemo, type FC } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { PageSkeleton } from '@/shared/ui/page-skeleton/page-skeleton'
import { useTabMeta, useWorkspaceTabsStore, useFormCacheStore } from '@/features/workspace-tabs'

import { useTreeStore } from '../lib/stores/tree-store'
import { useViewStateStore } from '../lib/stores/view-state-store'
import { useSduiCacheStore } from '../lib/stores/sdui-cache-store'
import { viewTransport } from '../api/view-transport'
import { useSduiDispatch } from '../lib/dispatch'
import { SduiSessionProvider, type SduiSessionValue } from '../lib/sdui-session-context'
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
  const navigate = useNavigate()
  const dirty = useViewStateStore((s) => s.dirty)
  const viewStateValues = useViewStateStore((s) => s.state)

  useTabMeta((tree?.props?.title as string | undefined) ?? '')

  useEffect(() => {
    useFormCacheStore.getState().setDirty(location.pathname, dirty)
  }, [location.pathname, dirty])

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
      useFormCacheStore.getState().setDirty(route, false)
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

  useEffect(() => {
    const pending = useFormCacheStore.getState().consumePendingAction(location.pathname)
    if (pending === 'save-and-close') {
      const route = location.pathname
      void dispatch({ type: 'COMMAND', command: 'save' }).then(() => {
        useFormCacheStore.getState().removeTab(route)
        useWorkspaceTabsStore.getState().closeTab(route)
        const { tabs } = useWorkspaceTabsStore.getState()
        if (tabs.length > 0) {
          const next = tabs[0]
          void navigate(next.path + next.search)
        } else {
          void navigate('/')
        }
      })
    }
  }, [location.pathname, dispatch, navigate])

  const sessionValue = useMemo<SduiSessionValue>(
    () => ({
      formSessionId: useTreeStore.getState().formSessionId,
      revision: useTreeStore.getState().revision,
      getValue: (binding) =>
        binding ? viewStateValues[binding] : undefined,
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
    }),
    [tree, dirty, viewStateValues],
  )

  if (!tree) return <PageSkeleton />

  return (
    <SduiSessionProvider value={sessionValue}>
      <NodeRenderer node={tree} />
      <DialogHost />
    </SduiSessionProvider>
  )
}
