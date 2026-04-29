import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
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
import { FormRenderer } from '@/features/form-renderer'
import { useTabMeta, useWorkspaceTabsStore } from '@/features/workspace-tabs'
import {
  fetchDictTypeMetadata,
  fetchDictEntryById,
  createDictEntry,
  updateDictEntry,
  type DictEntry,
  type DictEntryCreatePayload,
} from '@/features/dict-sidebar/api/dict-sidebar-api'
import { buildFallbackConfig } from '@/pages/documents/documents-entry/lib/utils/build-fallback-config'
import { PageHeader } from '@/widgets/page-header'
import { Button, DropdownButton } from '@/shared/ui/buttons'
import { showToast } from '@/shared/ui/toast/show-toast'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'
import { UnsavedChangesDialog } from '@/shared/ui/unsaved-changes-dialog/unsaved-changes-dialog'

export const DictionaryEntryPage = () => {
  const { moduleCode = '', pageCode = '', entryId } = useParams()
  const [domain] = useState(
    () =>
      new URLSearchParams(window.location.search).get('domain') ?? 'DICTIONARY'
  )
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
  })

  const form = useForm<Record<string, unknown>>()
  const { isDirty } = form.formState

  useEffect(() => {
    if (!entryData) return
    const values: Record<string, unknown> = { ...entryData.attributes }
    values.nameRu = entryData.nameRu
    values.nameKz = entryData.nameKz
    values.code = entryData.code
    form.reset(values)
  }, [entryData]) // eslint-disable-line react-hooks/exhaustive-deps

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
    void queryClient.invalidateQueries({
      queryKey: ['dict-entries', domain, moduleCode],
    })
    void queryClient.invalidateQueries({
      queryKey: ['dict-entry', domain, savedEntryId],
    })
    void queryClient.invalidateQueries({
      queryKey: ['dict-sidebar-entries', domain, moduleCode],
    })
    void queryClient.invalidateQueries({
      queryKey: ['dictionary-search'],
    })
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

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader title={pageTitle} onClose={handleClose} />

      <div className="flex items-center gap-2 pb-3">
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
        <DropdownButton label={t('actions.more')} disabled />
      </div>

      <div className="flex flex-1 flex-col gap-4 rounded-md border-ui-03">
        {isLoadingEntry ? null : (
          <FormRenderer
            config={formConfig}
            attributes={formAttributes}
            form={form}
            typeCode={moduleCode}
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
