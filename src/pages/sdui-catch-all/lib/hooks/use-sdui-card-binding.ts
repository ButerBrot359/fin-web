import { useEffect, useMemo, useState } from 'react'
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

import { useUnsavedChangesDialog } from '@/pages/documents/documents-entry/lib/hooks/use-unsaved-changes-dialog'

// После закрытия вкладки садимся на соседнюю вкладку рабочего стола (или дефолт,
// если вкладок не осталось) — карточка универсальная (документ/справочник),
// целевой list-путь неизвестен, сосед выбирается на клиенте (SCRUM-283 v2 §2.3;
// перенесено из sdui-document-page.tsx для SCRUM-360 этап B).
function navigateToNeighborTab(navigate: NavigateFunction): void {
  const { tabs } = useWorkspaceTabsStore.getState()
  if (tabs.length > 0) {
    const next = tabs[0]
    void navigate(next.path + next.search)
  } else {
    void navigate('/')
  }
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

  const [tabTitle, setTabTitle] = useState('')
  useTabMeta(tabTitle)

  const closeCurrentTab = () => {
    useFormCacheStore.getState().removeTab(location.pathname)
    useWorkspaceTabsStore.getState().closeTab(location.pathname)
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
      markDiscardDraftClose(location.pathname)
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
    [navigate]
  )

  return { tabsApi, pageTitle, unsavedDialog, handleClose }
}
