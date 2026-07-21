import { useMemo, useState, type FC } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'

import { SduiScreen, useViewStateStore, useTreeStore, useSduiDispatch } from '@/features/sdui'
import { useWorkspaceTabsStore, useFormCacheStore, useTabMeta } from '@/features/workspace-tabs'
import { PageHeader } from '@/widgets/page-header'
import { UnsavedChangesDialog } from '@/shared/ui/unsaved-changes-dialog/unsaved-changes-dialog'

import { useUnsavedChangesDialog } from '@/pages/documents/documents-entry/lib/hooks/use-unsaved-changes-dialog'

interface SduiDictionaryEntryPageProps {
  moduleCode: string
  // 404 от OPEN — тип не переведён (штатный гейт §2.3): хост откатывается на легаси
  onOpenFailed: () => void
}

export const SduiDictionaryEntryPage: FC<SduiDictionaryEntryPageProps> = ({
  moduleCode,
  onOpenFailed,
}) => {
  const { pageCode = '' } = useParams()
  const [searchParams] = useSearchParams()
  const domain = searchParams.get('domain') ?? 'DICTIONARY'
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useSduiDispatch()
  const queryClient = useQueryClient()

  const dirty = useViewStateStore((s) => s.dirty)
  const baseTitle = (useTreeStore((s) => s.root?.props?.title) as string | undefined) ?? ''
  const pageTitle = dirty ? `${baseTitle} *` : baseTitle

  const [tabTitle, setTabTitle] = useState('')
  useTabMeta(tabTitle)

  const listPath = `/modules/${pageCode}/dictionary/${moduleCode}?domain=${domain}`

  const closeCurrentTab = () => {
    useFormCacheStore.getState().removeTab(location.pathname)
    useWorkspaceTabsStore.getState().closeTab(location.pathname)
  }

  const unsavedDialog = useUnsavedChangesDialog({
    onSave: () => {
      // Имя команды и поведение — из серверного дескриптора (SCRUM-283 §4.6)
      const desc = useTreeStore.getState().onDirtyClose
      if (!desc?.command) return
      void dispatch({ type: 'COMMAND', command: desc.command }, desc.behavior)
    },
    onDiscard: () => {
      closeCurrentTab()
      void navigate(listPath)
    },
  })

  const handleClose = () => {
    if (dirty) {
      unsavedDialog.open()
    } else {
      closeCurrentTab()
      void navigate(listPath)
    }
  }

  const tabsApi = useMemo(
    () => ({
      shouldPersistSession: (route: string) =>
        useWorkspaceTabsStore.getState().tabs.some((tab) => tab.id === route),
      onDirtyChange: (route: string, dirty: boolean) =>
        useFormCacheStore.getState().setDirty(route, dirty),
      consumePendingAction: (route: string) =>
        useFormCacheStore.getState().consumePendingAction(route),
      onCloseAfter: (route: string) => {
        useFormCacheStore.getState().removeTab(route)
        useWorkspaceTabsStore.getState().closeTab(route)
      },
      onSavedAndClosed: (route: string) => {
        useFormCacheStore.getState().removeTab(route)
        useWorkspaceTabsStore.getState().closeTab(route)
        void navigate(listPath)
      },
    }),
    [navigate, listPath],
  )

  // При уходе SDUI-кэш списков может устареть для легаси-списка справочника
  const screenApi = useMemo(
    () => ({
      ...tabsApi,
      onOpenFailed: () => {
        void queryClient.invalidateQueries({ queryKey: ['dict-type'] })
        onOpenFailed()
      },
    }),
    [tabsApi, queryClient, onOpenFailed],
  )

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader title={pageTitle} onClose={handleClose} />
      <SduiScreen
        layoutCode={`dict.${moduleCode}.OBJECT_FORM`}
        {...screenApi}
        onTitleChange={setTabTitle}
      />
      <UnsavedChangesDialog
        open={unsavedDialog.isOpen}
        onSave={unsavedDialog.handleSave}
        onDiscard={unsavedDialog.handleDiscard}
        onCancel={unsavedDialog.handleCancel}
      />
    </div>
  )
}
