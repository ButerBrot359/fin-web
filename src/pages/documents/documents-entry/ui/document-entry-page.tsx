import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { useDocumentType, getFormEvents } from '@/entities/document-type'
import { useOptionalFormConfig } from '@/entities/form-config'

import { FormRenderer, type FormRendererHandle } from '@/features/form-renderer'
import { TarifikatsiyaFormLayout } from '@/features/tarifikatsiya'
import {
  useTabMeta,
  useWorkspaceTabsStore,
  useFormCache,
  useFormCacheStore,
} from '@/features/workspace-tabs'

import { PageHeader } from '@/widgets/page-header'
import { DocumentFormToolbar, type CommandButton } from '@/widgets/document-form-toolbar'

import { UnsavedChangesDialog } from '@/shared/ui/unsaved-changes-dialog/unsaved-changes-dialog'

import { SduiDocumentPage } from './sdui-document-page'
import { DocumentEntrySkeleton } from './document-entry-skeleton'
import { getFormAttributes } from '../lib/utils/get-form-attributes'
import {
  getDocumentListPath,
  getDocumentEntryPath,
} from '../lib/utils/get-document-paths'
import { buildFallbackConfig } from '../lib/utils/build-fallback-config'
import { useDocumentEntryForm } from '../lib/hooks/use-document-entry-form'
import { useDocumentEntryPrint } from '../lib/hooks/use-document-entry-print'
import { useDocumentEntryActions } from '../lib/hooks/use-document-entry-actions'
import { useUnsavedChangesDialog } from '../lib/hooks/use-unsaved-changes-dialog'

export const DocumentEntryPage = () => {
  const { moduleCode = '', pageCode = '' } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  const { title, attributes, newView } = useDocumentType(moduleCode)

  if (newView) {
    return <SduiDocumentPage moduleCode={moduleCode} />
  }
  const { config, isLoading: isLoadingConfig } =
    useOptionalFormConfig(moduleCode)
  const { form, isNew, existingEntry, isLoading } = useDocumentEntryForm()
  const { isDirty } = form.formState

  const formRendererRef = useRef<FormRendererHandle | null>(null)

  const { data: formEvents = [] } = useQuery({
    queryKey: ['form-events', moduleCode],
    queryFn: async () => {
      const response = await getFormEvents(moduleCode)
      const data = response.data
      return Array.isArray(data) ? data : ((data as { data?: string[] }).data ?? [])
    },
    staleTime: 10 * 60 * 1000,
  })

  const EVENT_BUTTON_CONFIG: Record<string, { label: string; order: number }> = {
    OnZapolnitPoVsemRabotnikamClick: {
      label: t('documentFormToolbar.fill'),
      order: 1,
    },
    OnRasschitatVseClick: {
      label: t('documentFormToolbar.calculateAll'),
      order: 2,
    },
  }

  const commandButtons: CommandButton[] = formEvents
    .filter((name) => name.endsWith('Click') && EVENT_BUTTON_CONFIG[name])
    .map((eventName) => ({
      eventName,
      label: EVENT_BUTTON_CONFIG[eventName].label,
      onClick: () => formRendererRef.current?.triggerEvent(eventName),
    }))
    .sort(
      (a, b) =>
        (EVENT_BUTTON_CONFIG[a.eventName]?.order ?? 99) -
        (EVENT_BUTTON_CONFIG[b.eventName]?.order ?? 99)
    )

  const handleClearAll =
    moduleCode === 'Tarifikatsiya'
      ? () => {
          formRendererRef.current?.clearAllTables()
        }
      : undefined

  const { pendingAction, markClosing } = useFormCache({
    tabId: location.pathname,
    form,
  })

  const listPath = getDocumentListPath({ pageCode, moduleCode })
  const formAttributes = getFormAttributes(attributes)
  const formConfig = config ?? buildFallbackConfig(formAttributes)

  const baseTitle = isNew
    ? t('documentEntry.newTitle', { name: title })
    : existingEntry?.nameRu || title
  const pageTitle = isDirty ? `${baseTitle} *` : baseTitle

  useTabMeta(baseTitle)

  const actions = useDocumentEntryActions({
    isNew,
    existingEntry: existingEntry ?? null,
    form,
    attributes,
  })

  const queryClient = useQueryClient()
  const [isAiGenerating, setIsAiGenerating] = useState(false)

  const handleAiSuccess = () => {
    void queryClient.invalidateQueries({
      queryKey: ['form-configs', undefined, moduleCode],
    })
  }

  const { printCommands, handlePrint, isPrintLoading } = useDocumentEntryPrint({
    moduleCode,
    entryId: existingEntry?.id,
  })

  const closeCurrentTab = () => {
    markClosing()
    useFormCacheStore.getState().removeTab(location.pathname)
    useWorkspaceTabsStore.getState().closeTab(location.pathname)
  }

  const unsavedDialog = useUnsavedChangesDialog({
    onSave: actions.handleSaveAndClose,
    onDiscard: () => {
      closeCurrentTab()
      void navigate(listPath)
    },
  })

  const handleClose = () => {
    if (isDirty) {
      unsavedDialog.open()
    } else {
      closeCurrentTab()
      void navigate(listPath)
    }
  }

  // Handle pending save-and-close triggered from tab bar
  useEffect(() => {
    if (pendingAction && !isLoading) {
      useFormCacheStore.getState().consumePendingAction(location.pathname)
      actions.handleSaveAndClose()
    }
  }, [pendingAction, isLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleMovements = () => {
    if (!isNew && existingEntry?.id) {
      const params = new URLSearchParams({ title: baseTitle })
      void navigate(
        `${getDocumentEntryPath({ pageCode, moduleCode }, existingEntry.id)}/movements?${params.toString()}`
      )
    }
  }

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader title={pageTitle} onClose={handleClose} />
      <DocumentFormToolbar
        isNew={isNew}
        isDirty={isDirty}
        actions={actions}
        print={{
          onPrint: handlePrint,
          isLoading: isPrintLoading,
          commands: printCommands,
        }}
        onMovements={handleMovements}
        commandButtons={commandButtons}
        onClearAll={handleClearAll}
        aiButton={{
          moduleCode,
          type: 'documents',
          configExists: config !== null,
          onSuccess: handleAiSuccess,
          onPendingChange: setIsAiGenerating,
        }}
      />

      <div className="flex flex-1 flex-col gap-4 rounded-md border-ui-03">
        {isLoadingConfig || isLoading || isAiGenerating ? (
          <DocumentEntrySkeleton />
        ) : moduleCode === 'Tarifikatsiya' ? (
          <TarifikatsiyaFormLayout
            config={formConfig}
            attributes={formAttributes}
            form={form}
            typeCode={moduleCode}
            handleRef={formRendererRef}
          />
        ) : (
          <FormRenderer
            config={formConfig}
            attributes={formAttributes}
            form={form}
            typeCode={moduleCode}
            handleRef={formRendererRef}
          />
        )}
      </div>

      <UnsavedChangesDialog
        open={unsavedDialog.isOpen}
        onSave={unsavedDialog.handleSave}
        onDiscard={unsavedDialog.handleDiscard}
        onCancel={unsavedDialog.handleCancel}
      />
    </div>
  )
}
