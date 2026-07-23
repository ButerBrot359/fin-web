import { useEffect, useMemo, useState, type FC } from 'react'
import {
  useLocation,
  useNavigate,
  type NavigateFunction,
} from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'

import {
  SduiScreen,
  useViewStateStore,
  useTreeStore,
  useSduiDispatch,
} from '@/features/sdui'
import {
  useWorkspaceTabsStore,
  useFormCacheStore,
  useTabMeta,
} from '@/features/workspace-tabs'

import { PageHeader } from '@/widgets/page-header'

import { invalidateDocumentQueries } from '@/shared/lib/query/invalidate-entities'
import { UnsavedChangesDialog } from '@/shared/ui/unsaved-changes-dialog/unsaved-changes-dialog'

import { useUnsavedChangesDialog } from '../lib/hooks/use-unsaved-changes-dialog'

interface SduiDocumentPageProps {
  moduleCode: string
}

// После закрытия вкладки садимся на соседнюю вкладку рабочего стола (или дефолт,
// если вкладок не осталось) — сервер маршрут не даёт, сосед выбирается на клиенте
// (SCRUM-283 v2 §2.3). Вызывать ПОСЛЕ closeTab, чтобы текущая уже была убрана.
function navigateToNeighborTab(navigate: NavigateFunction): void {
  const { tabs } = useWorkspaceTabsStore.getState()
  if (tabs.length > 0) {
    const next = tabs[0]
    void navigate(next.path + next.search)
  } else {
    void navigate('/')
  }
}

export const SduiDocumentPage: FC<SduiDocumentPageProps> = ({ moduleCode }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useSduiDispatch()
  const queryClient = useQueryClient()

  useEffect(() => {
    return () => {
      // SDUI пишет мимо TanStack Query — при уходе со страницы сбрасываем кэши
      // списков документов и ссылочных пикеров, чтобы показать свежие данные
      // (ключи — из use-eav-entries: ['document','entries',…]).
      invalidateDocumentQueries(queryClient)
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
      // «Не сохранять»: команда не шлётся — закрываем вкладку и садимся на соседнюю
      // сами, единообразно с onSave (SCRUM-283 v2 §2.3).
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
      shouldPersistSession: (route: string) =>
        useWorkspaceTabsStore.getState().tabs.some((tab) => tab.id === route),
      onDirtyChange: (route: string, dirty: boolean) => {
        useFormCacheStore.getState().setDirty(route, dirty)
      },
      consumePendingAction: (route: string) =>
        useFormCacheStore.getState().consumePendingAction(route),
      // closeAfter=true: закрыть вкладку. didNavigate=false (save+closeAfter, без
      // серверного navigate) → сесть на соседнюю; didNavigate=true (postAndClose
      // увёл в список) → только закрыть, не перебивая серверный переход (SCRUM-283 v2).
      onCloseAfter: (route: string, didNavigate?: boolean) => {
        useFormCacheStore.getState().removeTab(route)
        useWorkspaceTabsStore.getState().closeTab(route)
        if (!didNavigate) navigateToNeighborTab(navigate)
      },
    }),
    [navigate],
  )

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader title={pageTitle} onClose={handleClose} />
      <SduiScreen layoutCode={`${moduleCode}.ФормаОбъекта`} {...tabsApi} onTitleChange={setTabTitle} />
      <UnsavedChangesDialog
        open={unsavedDialog.isOpen}
        onSave={unsavedDialog.handleSave}
        onDiscard={unsavedDialog.handleDiscard}
        onCancel={unsavedDialog.handleCancel}
      />
    </div>
  )
}
