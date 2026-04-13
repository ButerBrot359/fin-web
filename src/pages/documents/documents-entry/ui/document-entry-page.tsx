import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

import { useDocumentType } from '@/entities/document-type'
import { useOptionalFormConfig } from '@/entities/form-config'

import { FormRenderer } from '@/features/form-renderer'

import { PageHeader } from '@/widgets/page-header'
import { DocumentFormToolbar } from '@/widgets/document-form-toolbar'

import { UnsavedChangesDialog } from '@/shared/ui/unsaved-changes-dialog/unsaved-changes-dialog'

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

  const { title, nameRu, nameKz, attributes } = useDocumentType(moduleCode)
  const { config, isLoading: isLoadingConfig } =
    useOptionalFormConfig(moduleCode)
  const { form, isNew, existingEntry, isLoading } = useDocumentEntryForm()
  const { isDirty } = form.formState

  const listPath = getDocumentListPath({ pageCode, moduleCode })
  const formAttributes = getFormAttributes(attributes)
  const formConfig = config ?? buildFallbackConfig(formAttributes)

  const baseTitle = isNew
    ? t('documentEntry.newTitle', { name: title })
    : existingEntry?.nameRu || title
  const pageTitle = isDirty ? `${baseTitle} *` : baseTitle

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
          nameRu,
          nameKz,
        }}
        onMovements={handleMovements}
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
