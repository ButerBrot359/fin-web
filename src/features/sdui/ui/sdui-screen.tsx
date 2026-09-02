import { useEffect, useMemo, type FC } from 'react'
import { useLocation } from 'react-router-dom'
import i18n from 'i18next'

import { PageSkeleton } from '@/shared/ui/page-skeleton/page-skeleton'

import {
  clearDiscardDraftClose,
  consumeDiscardDraftClose,
} from '../lib/close-intent'
import { useTreeStore } from '../lib/stores/tree-store'
import { useViewStateStore } from '../lib/stores/view-state-store'
import { useSduiCacheStore } from '../lib/stores/sdui-cache-store'
import { usePanelStore } from '../lib/stores/panel-store'
import { viewTransport } from '../api/view-transport'
import { useSduiDispatch } from '../lib/dispatch'
import { useSessionHeartbeat } from '../lib/hooks/use-session-heartbeat'
import { useTaskWatcher } from '../lib/hooks/use-task-watcher'
import {
  SduiSessionProvider,
  type SduiSessionValue,
} from '../lib/sdui-session-context'
import { reopenFormForLanguageChange } from '../lib/language-reopen'
import type { ViewTabMeta } from '../types/view'
import { NodeRenderer } from './node-renderer'
import { DialogHost } from './dialog-host'

interface SduiScreenProps {
  // Хост решает, сохранять ли сессию в кэш при размонтировании (вкладка ещё открыта)
  shouldPersistSession?: (route: string) => boolean
  // Колбэки для интеграции с вкладками; SDUI сам их не реализует
  onTitleChange?: (title: string) => void
  onDirtyChange?: (route: string, dirty: boolean) => void
  // Возвращает pending-действие ('save-and-close' | null) и потребляет его
  consumePendingAction?: (route: string) => string | null
  // Вызывается после успешного save-and-close: хост закрывает вкладку и навигирует
  onSavedAndClosed?: (route: string) => void
  // closeAfter=true из behavior: закрыть вкладку. didNavigate=true → сервер уже
  // увёл эффектом navigate (напр. postAndClose→список), хост навигацию не дублирует;
  // didNavigate=false (save+closeAfter) → хост садится на соседнюю вкладку (SCRUM-283 v2).
  onCloseAfter?: (route: string, didNavigate?: boolean) => void
  // Срабатывает на 404/422 OPEN — штатный гейт раскатки (§2 бэк-спеки
  // SCRUM-290): тип ещё не переведён на SDUI (SCREEN_NOT_SDUI → info.kind)
  // либо унаследованный 404. Хост может показать легаси-форму. Прочие
  // ошибки OPEN (сеть, 5xx) сюда не попадают — прежнее поведение (тост + скелетон).
  onOpenFailed?: (info?: { kind?: string }) => void
  // Маршрут не найден бэком (404 ROUTE_UNKNOWN) — экран NotFound на стороне хоста
  onRouteUnknown?: () => void
  // Метаданные вкладки с последнего OPEN (kind/icon/closable) — хост
  // использует для синхронизации рабочих вкладок
  onTab?: (tab: ViewTabMeta | null) => void
}

export const SduiScreen: FC<SduiScreenProps> = ({
  shouldPersistSession,
  onTitleChange,
  onDirtyChange,
  consumePendingAction,
  onSavedAndClosed,
  onCloseAfter,
  onOpenFailed,
  onRouteUnknown,
  onTab,
}) => {
  const location = useLocation()
  const tree = useTreeStore((s) => s.root)
  const reset = useTreeStore((s) => s.reset)
  const dispatch = useSduiDispatch()
  const dirty = useViewStateStore((s) => s.dirty)
  const formSessionId = useTreeStore((s) => s.formSessionId)
  useSessionHeartbeat(formSessionId)
  // SCRUM-330: поллинг фоновых задач формы + рапорт task.finished в сессию
  useTaskWatcher(formSessionId)

  const title = (tree?.props?.title as string | undefined) ?? ''
  useEffect(() => {
    onTitleChange?.(title)
  }, [title, onTitleChange])

  useEffect(() => {
    onDirtyChange?.(location.pathname, dirty)
  }, [location.pathname, dirty, onDirtyChange])

  useEffect(() => {
    const route = location.pathname
    // Стейл-интент discardDraft (например, от закрытия одноимённой легаси-
    // вкладки) не должен дожить до нашего CLOSE — снимаем на монтировании.
    clearDiscardDraftClose(route)

    // Восстановление из кэша рабочей вкладки ТОЛЬКО при несохранённых изменениях
    // (чтобы не потерять правки при переключении вкладок) — тогда без повторного
    // OPEN, серверная form-session ещё жива. Чистый документ при возврате
    // переоткрываем (OPEN), чтобы данные/статус были всегда актуальными.
    const cached = useSduiCacheStore.getState().get(route)
    if (cached?.dirty) {
      useTreeStore.getState().setRoot(cached.root)
      if (cached.formSessionId != null && cached.revision != null) {
        useTreeStore
          .getState()
          .setSession(cached.formSessionId, cached.revision)
      }
      // Экран всегда route-only (SCRUM-290): layoutCode больше не хранится
      // ни в кэше вкладки, ни в пропах — сброшен, реопен идёт по маршруту.
      useTreeStore.getState().setLayoutCode(null)
      useViewStateStore.getState().replaceAll(cached.viewState)
    } else {
      // main: устаревший кэш вкладки снимаем перед переоткрытием;
      // dev (SCRUM-244/290): 404/422 на OPEN → фолбэк на легаси через onOpenNotFound;
      // 404 ROUTE_UNKNOWN → onRouteUnknown (экран NotFound).
      if (cached) useSduiCacheStore.getState().remove(route)
      void dispatch({ type: 'OPEN' }, null, false, {
        onOpenNotFound: onOpenFailed,
        onRouteUnknown,
        onOpenTab: (tab) => onTab?.(tab),
      })
    }

    return () => {
      const persist = shouldPersistSession?.(route) ?? false
      const treeState = useTreeStore.getState()

      // Сохраняем сессию только при несохранённых изменениях: чистый документ на
      // unmount закрываем, чтобы при возврате переоткрыть со свежими данными.
      if (persist && treeState.root && useViewStateStore.getState().dirty) {
        useSduiCacheStore.getState().save(route, {
          root: treeState.root,
          formSessionId: treeState.formSessionId,
          revision: treeState.revision,
          viewState: useViewStateStore.getState().getAll(),
          dirty: useViewStateStore.getState().dirty,
        })
      } else {
        // SCRUM-276 (черновики): CLOSE при навигации черновик сохраняет;
        // discardDraft=true уходит только по интенту «Не сохранять».
        void dispatch(
          consumeDiscardDraftClose(route)
            ? { type: 'CLOSE', discardDraft: true }
            : { type: 'CLOSE' }
        )
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
    return () => {
      window.removeEventListener('beforeunload', handler)
    }
  }, [])

  // Смена языка: язык фиксируется в form-session на OPEN, поэтому нужен
  // re-OPEN. Отдельная подписка (а не deps главного эффекта): cleanup
  // с persist=true иначе сохранил бы стейл-сессию, которую restore-ветка
  // тут же воскресила бы.
  useEffect(() => {
    const handler = () => {
      void reopenFormForLanguageChange({
        dispatch,
        route: location.pathname,
      })
    }
    i18n.on('languageChanged', handler)
    return () => {
      i18n.off('languageChanged', handler)
    }
  }, [location.pathname, dispatch])

  useEffect(() => {
    const route = location.pathname
    const pending = consumePendingAction?.(route)
    if (pending === 'save-and-close') {
      // Имя команды и её поведение — из серверного дескриптора, не хардкод (§4.5)
      const desc = useTreeStore.getState().onDirtyClose
      if (!desc?.command) return
      void dispatch(
        { type: 'COMMAND', command: desc.command },
        desc.behavior
      ).then((ok) => {
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
      setDirty: useViewStateStore.getState().setDirty,
      tree,
      setRoot: useTreeStore.getState().setRoot,
      setSession: useTreeStore.getState().setSession,
      bumpRevision: useTreeStore.getState().bumpRevision,
      getLayoutCode: () => useTreeStore.getState().layoutCode,
      setLayoutCode: useTreeStore.getState().setLayoutCode,
      // closeAfter=true в root-сессии закрывает рабочую вкладку (без навигации)
      closeAfter: (didNavigate?: boolean) =>
        onCloseAfter?.(location.pathname, didNavigate),
      setOnDirtyClose: useTreeStore.getState().setOnDirtyClose,
      applyTreePatches: useTreeStore.getState().applyPatches,
      clearAllErrors: useTreeStore.getState().clearAllErrors,
    }),
    [tree, dirty, onCloseAfter, location.pathname]
  )

  if (!tree) return <PageSkeleton />

  return (
    <SduiSessionProvider value={sessionValue}>
      <NodeRenderer node={tree} />
      <DialogHost />
    </SduiSessionProvider>
  )
}
