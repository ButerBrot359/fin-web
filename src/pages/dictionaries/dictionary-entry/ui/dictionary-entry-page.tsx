import { useEffect, useMemo, useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  useQuery,
  useSuspenseQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import type { AxiosResponse } from 'axios'

import type { DocumentAttribute } from '@/entities/document-type'
import type { ApiResponse } from '@/shared/types/api.types'
import { useOptionalFormConfig } from '@/entities/form-config'
import { AiButton } from '@/features/generate-form-config'
import { FormRenderer } from '@/features/form-renderer'
import {
  useTabMeta,
  useWorkspaceTabsStore,
  useFormCache,
  useFormCacheStore,
} from '@/features/workspace-tabs'
import {
  markRestoring,
  unmarkRestoring,
} from '@/features/workspace-tabs/lib/hooks/use-form-cache-store'
import {
  fetchDictTypeMetadata,
  fetchDictEntryById,
  createDictEntry,
  updateDictEntry,
  type DictEntry,
  type DictEntryCreatePayload,
} from '@/features/dict-sidebar/api/dict-sidebar-api'
import { buildFallbackConfig } from '@/pages/documents/documents-entry/lib/utils/build-fallback-config'
import { invalidateDictionaryQueries } from '@/shared/lib/query/invalidate-entities'
import { PageHeader } from '@/widgets/page-header'
import { Button, DropdownButton } from '@/shared/ui/buttons'
import { ShimmerBlock } from '@/shared/ui/shimmer-block'
import { showToast } from '@/shared/ui/toast/show-toast'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'
import { UnsavedChangesDialog } from '@/shared/ui/unsaved-changes-dialog/unsaved-changes-dialog'

export const DictionaryEntryPage = () => {
  const { moduleCode = '', pageCode = '', entryId } = useParams()
  const [searchParams] = useSearchParams()
  const domain = searchParams.get('domain') ?? 'DICTIONARY'
  const copyFrom = searchParams.get('copyFrom')
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()

  const isNew = !entryId
  const [savedEntryId, setSavedEntryId] = useState<number | string | null>(
    entryId ?? null
  )

  const listPath = `/modules/${pageCode}/dictionary/${moduleCode}?domain=${domain}`

  const { data: typeData } = useSuspenseQuery({
    queryKey: ['dict-type', domain, moduleCode],
    queryFn: ({ signal }) => fetchDictTypeMetadata(domain, moduleCode, signal),
    staleTime: 5 * 60 * 1000,
    select: (res) => res.data.data,
  })

  const { data: entryData, isLoading: isLoadingEntry } = useQuery<
    AxiosResponse<ApiResponse<DictEntry>>,
    Error,
    DictEntry
  >({
    queryKey: ['dict-entry', domain, savedEntryId],
    queryFn: ({ signal }) => fetchDictEntryById(domain, savedEntryId!, signal),
    enabled: !!savedEntryId,
    select: (res) => res.data.data,
    // Актуальные данные записи при каждом открытии карточки справочника.
    refetchOnMount: 'always',
  })

  const { data: copyFromData, isLoading: isLoadingCopy } = useQuery<
    AxiosResponse<ApiResponse<DictEntry>>,
    Error,
    DictEntry
  >({
    queryKey: ['dict-entry', domain, copyFrom],
    queryFn: ({ signal }) => fetchDictEntryById(domain, copyFrom!, signal),
    enabled: isNew && !!copyFrom,
    select: (res) => res.data.data,
  })

  const form = useForm<Record<string, unknown>>()
  const { isDirty } = form.formState

  const restoredRef = useRef(false)

  useEffect(() => {
    if (isNew && copyFrom && !copyFromData) {
      useFormCacheStore.getState().clearCache(location.pathname)
      return
    }

    const cached = useFormCacheStore
      .getState()
      .getCachedValues(location.pathname)

    if (entryData) {
      const values: Record<string, unknown> = { ...entryData.attributes }
      values.nameRu = entryData.nameRu
      values.nameKz = entryData.nameKz
      values.code = entryData.code

      if (cached) {
        markRestoring(location.pathname)
        form.reset(values)
        for (const [key, value] of Object.entries(cached)) {
          form.setValue(key, value, { shouldDirty: true })
        }
        const hasDirtyFields = Object.keys(cached).some(
          (key) => JSON.stringify(cached[key]) !== JSON.stringify(values[key])
        )
        useFormCacheStore.getState().clearCache(location.pathname)
        useFormCacheStore.getState().setDirty(location.pathname, hasDirtyFields)
        restoredRef.current = hasDirtyFields
        queueMicrotask(() => {
          unmarkRestoring(location.pathname)
        })
      } else if (!form.formState.isDirty && !restoredRef.current) {
        form.reset(values)
      }
    } else if (isNew && copyFromData) {
      const { Nomer: _, Kod: _k, ...restAttrs } = (copyFromData.attributes ?? {}) as Record<string, unknown>
      const values: Record<string, unknown> = { ...restAttrs }
      values.nameRu = copyFromData.nameRu
      values.nameKz = copyFromData.nameKz

      if (cached) {
        markRestoring(location.pathname)
        form.reset({})
        for (const [key, value] of Object.entries(cached)) {
          form.setValue(key, value, { shouldDirty: true })
        }
        useFormCacheStore.getState().clearCache(location.pathname)
        useFormCacheStore.getState().setDirty(location.pathname, true)
        restoredRef.current = true
        queueMicrotask(() => {
          unmarkRestoring(location.pathname)
        })
      } else if (!form.formState.isDirty && !restoredRef.current) {
        form.reset({})
        for (const [key, value] of Object.entries(values)) {
          form.setValue(key, value, { shouldDirty: true })
        }
        restoredRef.current = true
      }
    } else if (isNew && cached) {
      markRestoring(location.pathname)
      form.reset(cached)
      useFormCacheStore.getState().clearCache(location.pathname)
      useFormCacheStore.getState().setDirty(location.pathname, true)
      restoredRef.current = true
      queueMicrotask(() => {
        unmarkRestoring(location.pathname)
      })
    }
  }, [entryData, copyFromData]) // eslint-disable-line react-hooks/exhaustive-deps

  const { pendingAction, markClosing } = useFormCache({
    tabId: location.pathname,
    form,
  })

  const formAttributes = useMemo(
    () =>
      [...typeData.attributes]
        .filter((attr: DocumentAttribute) => attr.showInForm)
        .sort(
          (a: DocumentAttribute, b: DocumentAttribute) =>
            a.sortOrder - b.sortOrder
        ),
    [typeData.attributes]
  )

  const { config } = useOptionalFormConfig(moduleCode, 'dictionaries', domain)
  const formConfig = config ?? buildFallbackConfig(formAttributes)

  const [isAiGenerating, setIsAiGenerating] = useState(false)

  const handleAiSuccess = () => {
    void queryClient.invalidateQueries({
      queryKey: ['form-configs', 'dictionaries', moduleCode],
    })
  }

  const typeName = getLocalizedName(typeData, i18n.language)

  const baseTitle = isNew
    ? t('documentEntry.newTitle', { name: typeName })
    : entryData
      ? getLocalizedName(entryData, i18n.language)
      : typeName
  const pageTitle = isDirty ? `${baseTitle} *` : baseTitle

  useTabMeta(baseTitle)

  const buildPayload = (
    data: Record<string, unknown>
  ): DictEntryCreatePayload => {
    const { nameRu, nameKz, code, parentId, sortOrder, ...attributes } = data
    return {
      nameRu: (nameRu as string) || '',
      nameKz: nameKz as string | undefined,
      code: code as string | undefined,
      parentId: parentId as number | null | undefined,
      sortOrder: sortOrder as number | undefined,
      attributes,
    }
  }

  const invalidateEntries = () => {
    // Свежие список справочника (страница), сайдбар и ссылочные пикеры сразу
    // после сохранения (ключ списка — use-eav-entries: ['dictionary','entries',…]).
    invalidateDictionaryQueries(queryClient)
  }

  const createMutation = useMutation<
    AxiosResponse<ApiResponse<DictEntry>>,
    Error,
    Record<string, unknown>
  >({
    mutationFn: (data) =>
      createDictEntry(domain, moduleCode, buildPayload(data)),
    onSuccess: (res, data) => {
      form.reset(data)
      const entry = res.data.data
      setSavedEntryId(entry.id)
      invalidateEntries()
      showToast('success', t('dictSidebar.saved'))
      void navigate(
        `/modules/${pageCode}/dictionary/${moduleCode}/${String(entry.id)}?domain=${domain}`,
        { replace: true }
      )
    },
    onError: () => {
      showToast('error', t('dictSidebar.saveError'))
    },
  })

  const updateMutation = useMutation<
    AxiosResponse<ApiResponse<DictEntry>>,
    Error,
    Record<string, unknown>
  >({
    mutationFn: (data) =>
      updateDictEntry(domain, savedEntryId!, buildPayload(data)),
    onSuccess: (_res, data) => {
      form.reset(data)
      invalidateEntries()
      showToast('success', t('dictSidebar.saved'))
    },
    onError: () => {
      showToast('error', t('dictSidebar.saveError'))
    },
  })

  const isSaving = createMutation.isPending || updateMutation.isPending

  const handleSave = form.handleSubmit((data) => {
    if (savedEntryId) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data)
    }
  })

  const closeCurrentTab = () => {
    markClosing()
    useFormCacheStore.getState().removeTab(location.pathname)
    useWorkspaceTabsStore.getState().closeTab(location.pathname)
  }

  const handleSaveAndClose = form.handleSubmit((data) => {
    const onDone = () => {
      invalidateEntries()
      closeCurrentTab()
      void navigate(listPath)
    }

    if (savedEntryId) {
      void updateDictEntry(domain, savedEntryId, buildPayload(data))
        .then(onDone)
        .catch(() => {
          showToast('error', t('dictSidebar.saveError'))
        })
    } else {
      void createDictEntry(domain, moduleCode, buildPayload(data))
        .then(onDone)
        .catch(() => {
          showToast('error', t('dictSidebar.saveError'))
        })
    }
  })

  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)

  const handleClose = () => {
    if (isDirty) {
      setShowUnsavedDialog(true)
    } else {
      closeCurrentTab()
      void navigate(listPath)
    }
  }

  // Handle pending save-and-close triggered from tab bar
  useEffect(() => {
    if (pendingAction && !isLoadingEntry) {
      useFormCacheStore.getState().consumePendingAction(location.pathname)
      void handleSaveAndClose()
    }
  }, [pendingAction, isLoadingEntry]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader title={pageTitle} onClose={handleClose} />

      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            disabled={isSaving}
            onClick={handleSaveAndClose}
          >
            {t('dictSidebar.saveAndClose')}
          </Button>
          <Button variant="secondary" disabled={isSaving} onClick={handleSave}>
            {t('dictSidebar.save')}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <AiButton
            moduleCode={moduleCode}
            type="dictionaries"
            domain={domain}
            configExists={config !== null}
            onSuccess={handleAiSuccess}
            onPendingChange={setIsAiGenerating}
          />
          <DropdownButton label={t('actions.more')} disabled />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 rounded-md border-ui-03">
        {isLoadingEntry || isLoadingCopy || isAiGenerating ? (
          <div className="flex flex-col gap-4">
            <ShimmerBlock className="h-12 w-1/3" />
            <ShimmerBlock className="h-12 w-1/2" />
            <ShimmerBlock className="h-12 w-2/5" />
            <ShimmerBlock className="h-12 w-1/4" />
            <ShimmerBlock className="h-12 w-1/3" />
          </div>
        ) : (
          <FormRenderer
            config={formConfig}
            attributes={formAttributes}
            form={form}
            typeCode={moduleCode}
            domain={domain}
          />
        )}
      </div>

      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onSave={() => {
          setShowUnsavedDialog(false)
          void handleSaveAndClose()
        }}
        onDiscard={() => {
          setShowUnsavedDialog(false)
          closeCurrentTab()
          void navigate(listPath)
        }}
        onCancel={() => {
          setShowUnsavedDialog(false)
        }}
      />
    </div>
  )
}
