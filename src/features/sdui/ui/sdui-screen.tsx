import { useEffect, useMemo, useRef, type FC } from 'react'
import { useLocation } from 'react-router-dom'
import i18n from 'i18next'

import { AccessDenied } from '@/shared/ui/access-denied'
import { ObjectNotFound } from '@/shared/ui/object-not-found'
import { PageSkeleton } from '@/shared/ui/page-skeleton/page-skeleton'
import { subscribeViewSettingsChanged } from '@/shared/lib/design-settings/design-settings-events'
import { tabRouteKey } from '@/shared/lib/router/form-instance-route'

import {
  clearDiscardDraftClose,
  consumeDiscardDraftClose,
} from '../lib/close-intent'
import { useTreeStore } from '../lib/stores/tree-store'
import { useViewStateStore } from '../lib/stores/view-state-store'
import { useSduiCacheStore } from '../lib/stores/sdui-cache-store'
import {
  useScreenAccessStore,
  type ScreenAccessState,
} from '../lib/access/screen-access-store'
import { usePanelStore } from '../lib/stores/panel-store'
import { viewTransport } from '../api/view-transport'
import { useSduiDispatch } from '../lib/dispatch'
import { useSessionHeartbeat } from '../lib/hooks/use-session-heartbeat'
import { useTaskWatcher } from '../lib/hooks/use-task-watcher'
import { useExternalViewRefresh } from '../lib/hooks/use-external-view-refresh'
import { useExternalPanelRefresh } from '../lib/hooks/use-external-panel-refresh'
import { useFormSaveHotkey } from '../lib/hooks/use-form-save-hotkey'
import {
  SduiSessionProvider,
  type SduiSessionValue,
} from '../lib/sdui-session-context'
import { reopenFormForLanguageChange } from '../lib/language-reopen'
import { isStretchedRoot } from '../lib/utils/stretched-root'
import { isFormReadOnly } from '../lib/utils/form-read-only'
import type { ViewTabMeta } from '../types/view'
import { NodeRenderer } from './node-renderer'
import { DialogHost } from './dialog-host'
import { CustomizeFormDialog } from './customize-form-dialog'
import { AdminCustomizeAutoOpen } from './admin-customize-auto-open'
import { ValidationReportHost } from './validation/validation-report-host'
import { useValidationReportStore } from '@/entities/validation-report'

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
  // Срабатывает ТОЛЬКО на 422 SCREEN_NOT_SDUI OPEN — штатный гейт раскатки
  // (§2 бэк-спеки SCRUM-290): тип ещё не переведён на SDUI. 403/404 легаси
  // больше НЕ открывают (SCRUM-400 §5.2/§9.5): «Нет доступа» и «Объект не
  // найден» экран рисует сам из screen-access-store. Прочие ошибки OPEN
  // (сеть, 5xx) сюда не попадают — прежнее поведение (тост + скелетон).
  onOpenFailed?: (info?: { kind?: string }) => void
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
  onTab,
}) => {
  const location = useLocation()
  // SCRUM-360 v6 §6.3: ключ экрана/сессии — pathname + маркер isGroup.
  // «Создать» и «Создать группу» делят pathname, но это разные формы: смена
  // маркера обязана переоткрыть сессию (CLOSE → OPEN), а кэши вкладок и
  // dirty-колбэки — различать их. Прочие query-параметры (в т.ч. ?ls= дерева,
  // который сервер меняет REPLACE_URL-эффектом) в ключ не входят.
  const screenRoute = tabRouteKey(location.pathname, location.search)
  const tree = useTreeStore((s) => s.root)
  const reset = useTreeStore((s) => s.reset)
  const dispatch = useSduiDispatch()
  const dirty = useViewStateStore((s) => s.dirty)
  const formSessionId = useTreeStore((s) => s.formSessionId)
  const accessState = useScreenAccessStore(
    (s): ScreenAccessState | undefined => s.byRoute[screenRoute]
  )
  useSessionHeartbeat(formSessionId)
  // SCRUM-330: поллинг фоновых задач формы + рапорт task.finished в сессию
  useTaskWatcher(formSessionId)
  useExternalViewRefresh(location.pathname + location.search, dispatch, onTab)
  useExternalPanelRefresh()
  const screenRootRef = useRef<HTMLDivElement>(null)
  useFormSaveHotkey(screenRootRef)
  const onTabRef = useRef(onTab)
  useEffect(() => {
    onTabRef.current = onTab
  }, [onTab])

  const title = (tree?.props?.title as string | undefined) ?? ''
  useEffect(() => {
    onTitleChange?.(title)
  }, [title, onTitleChange])

  useEffect(() => {
    onDirtyChange?.(screenRoute, dirty)
  }, [screenRoute, dirty, onDirtyChange])

  useEffect(() => {
    const route = screenRoute
    // Стейл-интент discardDraft (например, от закрытия одноимённой легаси-
    // вкладки) не должен дожить до нашего CLOSE — снимаем на монтировании.
    clearDiscardDraftClose(route)

    // SCRUM-317: ключ активного экрана для якорей тултипа-навигатора —
    // узлы дерева находят «свой» отчёт по нему, не читая роутер.
    useValidationReportStore.getState().setScreenKey(route)

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
      useViewStateStore.getState().setDirty(true)
    } else {
      // main: устаревший кэш вкладки снимаем перед переоткрытием;
      // dev (SCRUM-244/290): 422 SCREEN_NOT_SDUI на OPEN → фолбэк на легаси
      // через onOpenNotFound; 403/404 рисует сам экран (screen-access-store).
      if (cached) useSduiCacheStore.getState().remove(route)
      void dispatch({ type: 'OPEN' }, null, false, {
        onOpenNotFound: onOpenFailed,
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
      // SCRUM-317 §5.3: отчёт принадлежит карточке — гасим на размонтировании
      // экрана, а не только при открытии (грязный документ возвращается из
      // кэша вкладки без повторного OPEN).
      useValidationReportStore.getState().clear(route)
      // SCRUM-400: отказ принадлежит вкладке — закрыли вкладку, сняли отказ.
      useScreenAccessStore.getState().clear(route)
      reset()
    }
  }, [screenRoute])

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
        route: screenRoute,
        onOpenTab: (tab) => onTabRef.current?.(tab),
      })
    }
    i18n.on('languageChanged', handler)
    return () => {
      i18n.off('languageChanged', handler)
    }
  }, [screenRoute, dispatch])

  // Настройки вида изменились (ИИ-помощник или диалог «Изменить форму»,
  // конструктор дизайна Ф2): патч накладывает бэк, поэтому нужен re-OPEN —
  // механика та же, что при смене языка (CLOSE → сброс сторов → OPEN).
  // Грязную форму не переоткрываем: несохранённые правки дороже свежей
  // раскладки, патч и так применится при следующем открытии.
  useEffect(() => {
    return subscribeViewSettingsChanged(() => {
      if (useViewStateStore.getState().dirty) return
      void reopenFormForLanguageChange({
        dispatch,
        route: screenRoute,
      })
    })
  }, [screenRoute, dispatch])

  useEffect(() => {
    const route = screenRoute
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
  }, [screenRoute, dispatch, consumePendingAction, onSavedAndClosed])

  // Стабильность контекста — суть фикса M1: пересоздание только при смене tree/dirty,
  // не при каждом вводе символа.
  const sessionValue = useMemo<SduiSessionValue>(
    () => ({
      kind: 'root',
      screenRoute,
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
      readOnly: isFormReadOnly(tree),
      resetDirty: useViewStateStore.getState().resetDirty,
      setDirty: useViewStateStore.getState().setDirty,
      tree,
      getTree: () => useTreeStore.getState().root,
      setRoot: useTreeStore.getState().setRoot,
      setSession: useTreeStore.getState().setSession,
      bumpRevision: useTreeStore.getState().bumpRevision,
      getLayoutCode: () => useTreeStore.getState().layoutCode,
      setLayoutCode: useTreeStore.getState().setLayoutCode,
      setScreenKey: useTreeStore.getState().setScreenKey,
      // closeAfter=true в root-сессии закрывает рабочую вкладку (без навигации)
      closeAfter: (didNavigate?: boolean) =>
        onCloseAfter?.(screenRoute, didNavigate),
      setOnDirtyClose: useTreeStore.getState().setOnDirtyClose,
      applyTreePatches: useTreeStore.getState().applyPatches,
      clearAllErrors: useTreeStore.getState().clearAllErrors,
    }),
    [tree, dirty, onCloseAfter, screenRoute]
  )

  // SCRUM-400: отказ экрана авторитетнее скелетона и дерева — 403/404 могли
  // прийти и на переоткрытии уже отрисованной формы (отзыв прав, смена языка).
  if (accessState?.kind === 'denied') {
    return <AccessDenied message={accessState.message} />
  }
  if (accessState?.kind === 'not-found') return <ObjectNotFound />

  if (!tree) return <PageSkeleton />

  // Своя прокрутка растянутому корню обязательна по той же причине, что в PageNode:
  // у ТЧ внутри есть пол высоты, и в низком окне она вытекала бы поверх подвала.
  const rastyanutyyKoren = isStretchedRoot(tree)

  return (
    <SduiSessionProvider value={sessionValue}>
      {/* SCRUM-317: граница поиска якорей тултипа — свой экран, не документ
          целиком (панели-порталы рендерят те же узлы). display:contents не
          участвует в раскладке. */}
      <div
        ref={screenRootRef}
        className={
          rastyanutyyKoren
            ? 'flex min-h-0 flex-1 flex-col overflow-y-auto'
            : undefined
        }
        style={rastyanutyyKoren ? undefined : { display: 'contents' }}
        data-sdui-screen-root
      >
        <NodeRenderer node={tree} />
      </div>
      <DialogHost />
      <ValidationReportHost />
      <CustomizeFormDialog />
      <AdminCustomizeAutoOpen />
    </SduiSessionProvider>
  )
}
