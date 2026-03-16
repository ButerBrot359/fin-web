import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import type { AxiosResponse } from 'axios'

import {
  useDocumentType,
  type DocumentAttribute,
} from '@/entities/document-type'
import { printDocumentEntry } from '@/entities/document-entry'
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
  const { t, i18n } = useTranslation()
  const { title, attributes } = useDocumentType(moduleCode)
  const { config, isLoading: isLoadingConfig } =
    useOptionalFormConfig(moduleCode)

  const { form, isNew, existingEntry, isLoadingEntry } = useDocumentEntryForm()

  const { handleSave, handlePost, handlePostAndClose } =
    useDocumentEntryActions({
      isNew,
      existingEntry: existingEntry ?? null,
      form,
    })

  const { mutate: mutatePrint, isPending: isPrintLoading } = useMutation({
    mutationFn: async () => {
      const response: AxiosResponse<Blob> = await printDocumentEntry(
        moduleCode,
        existingEntry!.id,
        i18n.language === 'kz' ? 'Kz' : undefined
      )
      return response.data
    },
    onSuccess: (blob: Blob) => {
      const blobUrl = URL.createObjectURL(blob)
      window.open(blobUrl, '_blank')
    },
  })

  const handlePrint = () => {
    if (!existingEntry?.id) return
    mutatePrint()
  }

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
        isNew={isNew}
        onSave={handleSave}
        onPost={handlePost}
        onPostAndClose={handlePostAndClose}
        onPrint={handlePrint}
        isPrintLoading={isPrintLoading}
      />

      <div className="flex flex-1 flex-col gap-4 rounded-md border-ui-03">
        {isLoadingConfig || isLoadingEntry ? (
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
    </div>
  )
}
