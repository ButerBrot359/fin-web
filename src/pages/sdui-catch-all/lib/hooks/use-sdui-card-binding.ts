import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  useLocation,
  useNavigate,
  type NavigateFunction,
} from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'

import {
  useViewStateStore,
  useTreeStore,
  useSduiDispatch,
  markDiscardDraftClose,
} from '@/features/sdui'
import {
  useWorkspaceTabsStore,
  useFormCacheStore,
  useTabMeta,
} from '@/features/workspace-tabs'

import { invalidateDocumentQueries } from '@/shared/lib/query/invalidate-entities'
import { tabRouteKey } from '@/shared/lib/router/form-instance-route'

import { useUnsavedChangesDialog } from '@/pages/documents/documents-entry/lib/hooks/use-unsaved-changes-dialog'

// После закрытия вкладки садимся на СОСЕДНЮЮ вкладку рабочего стола (или дефолт,
// если вкладок не осталось) — карточка универсальная (документ/справочник),
// целевой list-путь неизвестен, сосед выбирается на клиенте (SCRUM-283 v2 §2.3).
// SCRUM-386 фикс 1: соседа уже выбрал closeTab (activeTabId), раньше здесь
// брался tabs[0] — закрытие крестиком уводило на первую вкладку.
function navigateToNeighborTab(navigate: NavigateFunction): void {
  const { tabs, activeTabId } = useWorkspaceTabsStore.getState()
  if (tabs.length === 0) {
    void navigate('/')
    return
  }
  const next = tabs.find((t) => t.id === activeTabId) ?? tabs[0]
  // Панельная вкладка живёт вне роутера — активирована стором, навигация сломала бы URL
  if (next.pageType === 'sdui-panel') return
  void navigate(next.path + next.search)
}

// Обвязка карточки (документ/справочник) поверх catch-all SduiScreen: стабильный
// tabsApi, dirty-заголовок, диалог несохранённых изменений, синхронизация
// заголовка вкладки. Хук вызывается всегда (и для списковых kind — колбэки для
// них безвредны), чтобы SduiScreen не размонтировался при смене serverKind.
export function useSduiCardBinding() {
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useSduiDispatch()
  const queryClient = useQueryClient()
  // SCRUM-360 v6 §6.3: маршрутный ключ экрана с маркером isGroup — тот же,
  // что у id вкладки и route-колбэков SduiScreen («Создать»/«Создать группу»
  // делят pathname, но живут в разных вкладках).
  const screenRoute = tabRouteKey(location.pathname, location.search)

  useEffect(() => {
    return () => {
      // SDUI пишет мимо TanStack Query — при уходе с карточки сбрасываем кэши
      // списков документов/справочников и ссылочных пикеров (объединение
      // доноров sdui-document-page.tsx + sdui-dictionary-entry-page.tsx; лишняя
      // инвалидация кэша безвредна).
      invalidateDocumentQueries(queryClient)
      void queryClient.invalidateQueries({ queryKey: ['dict-type'] })
      // SCRUM-353: карточка записи регистра сведений — список должен показать
      // созданную/изменённую запись сразу (ключ use-eav-entries IR-домена).
      void queryClient.invalidateQueries({
        queryKey: ['information-register', 'entries'],
      })
    }
  }, [queryClient])

  const dirty = useViewStateStore((s) => s.dirty)
  const baseTitle =
    (useTreeStore((s) => s.root?.props?.title) as string | undefined) ?? ''
  const pageTitle = dirty ? `${baseTitle} *` : baseTitle

  // Заголовок предыдущего экрана не должен доехать до вкладки следующего:
  // SduiCardScreen не размонтируется на смене маршрута (SCRUM-360 этап B), и
  // до ответа OPEN в состоянии лежит имя прошлой формы — вкладка показывала
  // чужое название, пока не придёт своё. Заголовок хранится вместе с маршрутом,
  // которому принадлежит, и на смене маршрута сбрасывается тем же рендером —
  // до эффектов, поэтому чужое имя в стор вкладок не уходит. Пустой заголовок
  // useTabMeta не пишет, так что имя уже названной вкладки этим не теряется.
  const [titleState, setTitleState] = useState({
    route: screenRoute,
    title: '',
  })
  if (titleState.route !== screenRoute) {
    setTitleState({ route: screenRoute, title: '' })
  }
  const setTabTitle = useCallback((title: string) => {
    setTitleState((prev) => ({ route: prev.route, title }))
  }, [])
  useTabMeta(titleState.title)

  const closeCurrentTab = () => {
    useFormCacheStore.getState().removeTab(screenRoute)
    useWorkspaceTabsStore.getState().closeTab(screenRoute)
  }

  const unsavedDialog = useUnsavedChangesDialog({
    onSave: () => {
      // Имя команды и поведение — из серверного дескриптора (SCRUM-283 §4.6).
      // closeCurrentTab/navigate здесь НЕ нужны: у дескриптора closeAfter=true —
      // dispatch сам закроет вкладку и сядет на соседнюю через onCloseAfter (§4.3).
      const desc = useTreeStore.getState().onDirtyClose
      if (!desc?.command) return
      void dispatch({ type: 'COMMAND', command: desc.command }, desc.behavior)
    },
    onDiscard: () => {
      // «Не сохранять» → ближайший CLOSE уйдёт с discardDraft=true (SCRUM-276)
      markDiscardDraftClose(screenRoute)
      closeCurrentTab()
      navigateToNeighborTab(navigate)
    },
  })

  const handleClose = () => {
    if (dirty) {
      unsavedDialog.open()
    } else {
      closeCurrentTab()
      navigateToNeighborTab(navigate)
    }
  }

  const tabsApi = useMemo(
    () => ({
      // Стабильные колбэки: SduiScreen подписан на них эффектами,
      // пересоздание на каждый рендер вызвало бы лишние срабатывания.
      onTitleChange: setTabTitle,
      shouldPersistSession: (route: string) =>
        useWorkspaceTabsStore.getState().tabs.some((tab) => tab.id === route),
      onDirtyChange: (route: string, dirty: boolean) => {
        useFormCacheStore.getState().setDirty(route, dirty)
      },
      consumePendingAction: (route: string) =>
        useFormCacheStore.getState().consumePendingAction(route),
      // Успешный save-and-close: закрыть вкладку и сесть на соседнюю (listPath
      // не знаем — универсальная карточка, вариант дедовки sdui-dictionary-entry-page).
      onSavedAndClosed: (route: string) => {
        useFormCacheStore.getState().removeTab(route)
        useWorkspaceTabsStore.getState().closeTab(route)
        navigateToNeighborTab(navigate)
      },
      // closeAfter=true: закрыть вкладку. didNavigate=false (save+closeAfter, без
      // серверного navigate) → сесть на соседнюю; didNavigate=true (postAndClose
      // увёл в список) → только закрыть, не перебивая серверный переход (SCRUM-283 v2).
      onCloseAfter: (route: string, didNavigate?: boolean) => {
        useFormCacheStore.getState().removeTab(route)
        useWorkspaceTabsStore.getState().closeTab(route)
        if (!didNavigate) navigateToNeighborTab(navigate)
      },
    }),
    [navigate, setTabTitle]
  )

  return { tabsApi, pageTitle, unsavedDialog, handleClose }
}
