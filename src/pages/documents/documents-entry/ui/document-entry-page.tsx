import { useCallback, useEffect, useMemo } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation } from '@tanstack/react-query'

import {
  useDocumentType,
  type DocumentAttribute,
} from '@/entities/document-type'
import {
  getNewDocumentEntry,
  createDocumentEntry,
  type CreateDocumentEntryPayload,
} from '@/entities/document-entry'
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
  const { moduleCode = '', pageCode = '', entryId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { title, attributes } = useDocumentType(moduleCode)
  const { config, isLoading } = useOptionalFormConfig(moduleCode)

  const isNew = !entryId || entryId === 'new'
  const vidOperatsii = searchParams.get('VidOperatsii')

  const newEntryParams = useMemo(() => {
    if (!vidOperatsii) return undefined
    return { VidOperatsii: vidOperatsii }
  }, [vidOperatsii])

  const { data: newEntryData } = useQuery({
    queryKey: ['document-entry-new', moduleCode, newEntryParams],
    queryFn: () => getNewDocumentEntry(moduleCode, newEntryParams),
    enabled: isNew && !!newEntryParams,
    select: (response) => response.data.data,
  })

  const form = useForm<Record<string, unknown>>({
    defaultValues: {},
  })

  useEffect(() => {
    if (newEntryData?.attributes) {
      form.reset(newEntryData.attributes)
    }
  }, [newEntryData, form])

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

  const { mutate } = useMutation({
    mutationFn: (payload: CreateDocumentEntryPayload) =>
      createDocumentEntry(moduleCode, payload),
  })

  const buildPayload = useCallback(
    (isPosted: boolean): CreateDocumentEntryPayload => ({
      code: '',
      nameRu: '',
      nameKz: '',
      parentId: null,
      sortOrder: 0,
      isPosted,
      attributes: form.getValues(),
    }),
    [form]
  )

  const handleSave = useCallback(() => {
    mutate(buildPayload(false))
  }, [buildPayload, mutate])

  const handlePost = useCallback(() => {
    mutate(buildPayload(true))
  }, [buildPayload, mutate])

  const handlePostAndClose = useCallback(() => {
    mutate(buildPayload(true), {
      onSuccess: () => {
        void navigate(`/modules/${pageCode}/document/${moduleCode}`)
      },
    })
  }, [buildPayload, mutate, navigate, pageCode, moduleCode])

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader title={pageTitle} />
      <DocumentFormToolbar
        onSave={handleSave}
        onPost={handlePost}
        onPostAndClose={handlePostAndClose}
      />

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
