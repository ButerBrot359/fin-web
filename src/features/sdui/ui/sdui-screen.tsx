import { useEffect, useMemo, type FC } from 'react'
import { useLocation } from 'react-router-dom'

import { PageSkeleton } from '@/shared/ui/page-skeleton/page-skeleton'

import { useTreeStore } from '../lib/stores/tree-store'
import { useViewStateStore } from '../lib/stores/view-state-store'
import { useSduiCacheStore } from '../lib/stores/sdui-cache-store'
import { usePanelStore } from '../lib/stores/panel-store'
import { viewTransport } from '../api/view-transport'
import { useSduiDispatch } from '../lib/dispatch'
import { SduiSessionProvider, type SduiSessionValue } from '../lib/sdui-session-context'
import { NodeRenderer } from './node-renderer'
import { DialogHost } from './dialog-host'

interface SduiScreenProps {
  layoutCode?: string
  // Хост решает, сохранять ли сессию в кэш при размонтировании (вкладка ещё открыта)
  shouldPersistSession?: (route: string) => boolean
  // Колбэки для интеграции с вкладками; SDUI сам их не реализует
  onTitleChange?: (title: string) => void
  onDirtyChange?: (route: string, dirty: boolean) => void
  // Возвращает pending-действие ('save-and-close' | null) и потребляет его
  consumePendingAction?: (route: string) => string | null
  // Вызывается после успешного save-and-close: хост закрывает вкладку и навигирует
  onSavedAndClosed?: (route: string) => void
}

export const SduiScreen: FC<SduiScreenProps> = ({
  layoutCode,
  shouldPersistSession,
  onTitleChange,
  onDirtyChange,
  consumePendingAction,
  onSavedAndClosed,
}) => {
  const location = useLocation()
  const tree = useTreeStore((s) => s.root)
  const reset = useTreeStore((s) => s.reset)
  const dispatch = useSduiDispatch()
  const dirty = useViewStateStore((s) => s.dirty)

  const title = (tree?.props?.title as string | undefined) ?? ''
  useEffect(() => {
    onTitleChange?.(title)
  }, [title, onTitleChange])

  useEffect(() => {
    onDirtyChange?.(location.pathname, dirty)
  }, [location.pathname, dirty, onDirtyChange])

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
      const persist = shouldPersistSession?.(route) ?? false
      const treeState = useTreeStore.getState()

      if (persist && treeState.root) {
        useSduiCacheStore.getState().save(route, {
          root: treeState.root,
          formSessionId: treeState.formSessionId,
          revision: treeState.revision,
          viewState: useViewStateStore.getState().getAll(),
          dirty: useViewStateStore.getState().dirty,
        })
      } else {
        void dispatch({ type: 'CLOSE' })
        useSduiCacheStore.getState().remove(route)
        // Сбросить state+dirty: SDUI-экран размонтирован, стейл dirty
        // не должен триггерить confirm переключения языка
        useViewStateStore.getState().replaceAll({})
      }
      onDirtyChange?.(route, false)
      usePanelStore.getState().reset()
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
    const route = location.pathname
    const pending = consumePendingAction?.(route)
    if (pending === 'save-and-close') {
      void dispatch({ type: 'COMMAND', command: 'save' }).then((ok) => {
        if (!ok) return
        onSavedAndClosed?.(route)
      })
    }
  }, [location.pathname, dispatch, consumePendingAction, onSavedAndClosed])

  // Стабильность контекста — суть фикса M1: пересоздание только при смене tree/dirty,
  // не при каждом вводе символа.
  const sessionValue = useMemo<SduiSessionValue>(
    () => ({
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
      applyTreePatches: useTreeStore.getState().applyPatches,
      clearAllErrors: useTreeStore.getState().clearAllErrors,
    }),
    [tree, dirty],
  )

  if (!tree) return <PageSkeleton />

  return (
    <SduiSessionProvider value={sessionValue}>
      <NodeRenderer node={tree} />
      <DialogHost />
    </SduiSessionProvider>
  )
}
