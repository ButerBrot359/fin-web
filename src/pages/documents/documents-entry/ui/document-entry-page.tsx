import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { useDocumentType } from '@/entities/document-type'
import { useOptionalFormConfig } from '@/entities/form-config'

import { FormRenderer } from '@/features/form-renderer'

import { PageHeader } from '@/widgets/page-header'
import { DocumentFormToolbar } from '@/widgets/document-form-toolbar'
import { UnsavedChangesDialog } from '@/shared/ui/unsaved-changes-dialog/unsaved-changes-dialog'

import { buildFallbackConfig } from '../lib/utils/build-fallback-config'
import { getDocumentListPath } from '../lib/utils/get-document-paths'
import { getFormAttributes } from '../lib/utils/get-form-attributes'
import { useDocumentEntryForm } from '../lib/hooks/use-document-entry-form'
import { useDocumentEntryActions } from '../lib/hooks/use-document-entry-actions'
import { useDocumentEntryPrint } from '../lib/hooks/use-document-entry-print'
import { useUnsavedChangesDialog } from '../lib/hooks/use-unsaved-changes-dialog'
import { DocumentEntrySkeleton } from './document-entry-skeleton'

export const DocumentEntryPage = () => {
  const { moduleCode = '', pageCode = '' } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { title, nameRu, nameKz, attributes } = useDocumentType(moduleCode)
  const { config, isLoading: isLoadingConfig } =
    useOptionalFormConfig(moduleCode)
  const { form, isNew, existingEntry, isLoading } = useDocumentEntryForm()
  const { isDirty } = form.formState

  const listPath = getDocumentListPath({ pageCode, moduleCode })

  const formAttributes = useMemo(
    () => getFormAttributes(attributes),
    [attributes]
  )

  const formConfig = useMemo(
    () => config ?? buildFallbackConfig(formAttributes),
    [config, formAttributes]
  )

  const pageTitle = useMemo(() => {
    const base = isNew
      ? t('documentEntry.newTitle', { name: title })
      : existingEntry?.nameRu || title
    return isDirty ? `${base} *` : base
  }, [isNew, t, title, existingEntry?.nameRu, isDirty])

  const actions = useDocumentEntryActions({
    isNew,
    existingEntry: existingEntry ?? null,
    form,
    attributes,
  })

  const { handlePrint, isPrintLoading } = useDocumentEntryPrint({
    moduleCode,
    entryId: existingEntry?.id,
  })

  const unsavedDialog = useUnsavedChangesDialog({
    onSave: actions.handleSaveAndClose,
    onDiscard: () => {
      void navigate(listPath)
    },
  })

  const handleClose = () => {
    if (isDirty) {
      unsavedDialog.open()
    } else {
      void navigate(listPath)
    }
  }

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader title={pageTitle} onClose={handleClose} />
      <DocumentFormToolbar
        isNew={isNew}
        isDirty={isDirty}
        onSave={actions.handleSave}
        onPost={actions.handlePost}
        onPostAndClose={actions.handlePostAndClose}
        onPrint={handlePrint}
        isPrintLoading={isPrintLoading}
        printNameRu={nameRu}
        printNameKz={nameKz}
      />

      <div className="flex flex-1 flex-col gap-4 rounded-md border-ui-03">
        {isLoadingConfig || isLoading ? (
          <DocumentEntrySkeleton />
        ) : (
          <FormRenderer
            config={formConfig}
            attributes={formAttributes}
            form={form}
            typeCode={moduleCode}
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
