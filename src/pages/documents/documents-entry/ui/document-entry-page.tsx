import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import {
  useDocumentType,
  type DocumentAttribute,
} from '@/entities/document-type'
import { useOptionalFormConfig } from '@/entities/form-config'

import { FormRenderer } from '@/features/form-renderer'

import { PageHeader } from '@/widgets/page-header'
import { DocumentFormToolbar } from '@/widgets/document-form-toolbar'

import { buildFallbackConfig } from '../lib/utils/build-fallback-config'
import { useDocumentEntryForm } from '../lib/hooks/use-document-entry-form'
import { useDocumentEntryActions } from '../lib/hooks/use-document-entry-actions'
import { DocumentEntrySkeleton } from './document-entry-skeleton'

export const DocumentEntryPage = () => {
  const { moduleCode = '' } = useParams()
  const { t } = useTranslation()
  const { title, attributes } = useDocumentType(moduleCode)
  const { config, isLoading: isLoadingConfig } =
    useOptionalFormConfig(moduleCode)

  const { form, isNew, existingEntry, isLoadingEntry } = useDocumentEntryForm()

  const { handleSave, handlePost, handlePostAndClose } =
    useDocumentEntryActions({ isNew, form })

  const pageTitle = isNew
    ? t('documentEntry.newTitle', { name: title })
    : existingEntry?.nameRu || title

  const formAttributes = attributes
    .filter((attr: DocumentAttribute) => attr.showInForm)
    .sort(
      (a: DocumentAttribute, b: DocumentAttribute) => a.sortOrder - b.sortOrder
    )

  const formConfig = useMemo(
    () => config ?? buildFallbackConfig(formAttributes),
    [config, formAttributes]
  )

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader title={pageTitle} />
      <DocumentFormToolbar
        onSave={handleSave}
        onPost={handlePost}
        onPostAndClose={handlePostAndClose}
      />

      <div className="flex flex-1 flex-col gap-4 rounded-md border-ui-03">
        {isLoadingConfig || isLoadingEntry ? (
          <DocumentEntrySkeleton />
        ) : (
          <FormRenderer
            config={formConfig}
            attributes={formAttributes}
            form={form}
          />
        )}
      </div>
    </div>
  )
}
