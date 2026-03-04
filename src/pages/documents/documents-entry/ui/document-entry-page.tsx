import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'

import {
  useDocumentType,
  type DocumentAttribute,
} from '@/entities/document-type'
import {
  useOptionalFormConfig,
  type FormConfig,
  type VStackNode,
} from '@/entities/form-config'
import { FormRenderer } from '@/features/form-renderer'
import { PageHeader } from '@/widgets/page-header'
import { DocumentFormToolbar } from '@/widgets/document-form-toolbar'

const MOCK_ENTRY_NUMBER = '000000001'

const buildFallbackConfig = (attributes: DocumentAttribute[]): FormConfig => ({
  name: 'fallback',
  title: '',
  layout: {
    type: 'VStack',
    gap: 4,
    children: attributes.map((attr) => ({
      type: 'Field' as const,
      code: attr.code,
    })),
  } satisfies VStackNode,
})

export const DocumentEntryPage = () => {
  const { moduleCode = '', entryId } = useParams()
  const { t } = useTranslation()
  const { title, attributes } = useDocumentType(moduleCode)
  const { config, isLoading } = useOptionalFormConfig(moduleCode)

  const form = useForm<Record<string, unknown>>({
    defaultValues: {},
  })

  const isNew = !entryId || entryId === 'new'

  const pageTitle = isNew
    ? t('documentEntry.newTitle', { name: title })
    : t('documentEntry.editTitle', { name: title, number: MOCK_ENTRY_NUMBER })

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
      <DocumentFormToolbar />

      <div className="flex flex-1 flex-col gap-4 rounded-md border-ui-03">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-ui-05">
            ...
          </div>
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
