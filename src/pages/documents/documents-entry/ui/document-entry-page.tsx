import { useCallback, useEffect, useMemo } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import {
  useDocumentType,
  type DocumentAttribute,
} from '@/entities/document-type'
import {
  getDocumentEntry,
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
import { showToast } from '@/shared/ui/toast/show-toast'

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

  const { data: existingEntry, isLoading: isLoadingEntry } = useQuery({
    queryKey: ['document-entry', entryId],
    queryFn: () => getDocumentEntry(entryId!),
    enabled: !isNew,
    select: (response) => response.data.data,
  })

  const form = useForm<Record<string, unknown>>({
    defaultValues: {},
  })

  useEffect(() => {
    if (isNew && newEntryData?.attributes) {
      form.reset(newEntryData.attributes)
    }
  }, [newEntryData, form, isNew])

  useEffect(() => {
    if (!isNew && existingEntry?.attributes) {
      form.reset(existingEntry.attributes)
    }
  }, [existingEntry, form, isNew])

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

  const queryClient = useQueryClient()

  const { mutate } = useMutation({
    mutationFn: (payload: CreateDocumentEntryPayload) =>
      createDocumentEntry(moduleCode, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['document-entries', moduleCode],
      })
    },
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
    mutate(buildPayload(false), {
      onSuccess: (response) => {
        const entry = response.data.data
        showToast('info', t('documentEntry.saved'))
        if (isNew) {
          void navigate(
            `/modules/${pageCode}/document/${moduleCode}/${String(entry.id)}`,
            { replace: true }
          )
        }
      },
      onError: () => {
        showToast('error', t('documentEntry.saveError'))
      },
    })
  }, [buildPayload, mutate, isNew, navigate, pageCode, moduleCode, t])

  const handlePost = useCallback(() => {
    mutate(buildPayload(true), {
      onSuccess: (response) => {
        const entry = response.data.data
        showToast('info', t('documentEntry.posted'))
        if (isNew) {
          void navigate(
            `/modules/${pageCode}/document/${moduleCode}/${String(entry.id)}`,
            { replace: true }
          )
        }
      },
      onError: () => {
        showToast('error', t('documentEntry.postError'))
      },
    })
  }, [buildPayload, mutate, isNew, navigate, pageCode, moduleCode, t])

  const handlePostAndClose = useCallback(() => {
    mutate(buildPayload(true), {
      onSuccess: () => {
        showToast('info', t('documentEntry.posted'))
        void navigate(`/modules/${pageCode}/document/${moduleCode}`)
      },
      onError: () => {
        showToast('error', t('documentEntry.postError'))
      },
    })
  }, [buildPayload, mutate, navigate, pageCode, moduleCode, t])

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader title={pageTitle} />
      <DocumentFormToolbar
        onSave={handleSave}
        onPost={handlePost}
        onPostAndClose={handlePostAndClose}
      />

      <div className="flex flex-1 flex-col gap-4 rounded-md border-ui-03">
        {isLoading || isLoadingEntry ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="animate-shimmer h-[50px] rounded-md bg-linear-to-r from-ui-02 via-ui-03/30 to-ui-02 bg-size-[800px_100%]"
              />
            ))}
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
