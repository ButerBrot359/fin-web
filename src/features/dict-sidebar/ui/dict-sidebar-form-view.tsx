import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { AxiosResponse } from 'axios'

import type { DocumentType, DocumentAttribute } from '@/entities/document-type'
import { FormRenderer } from '@/features/form-renderer'
import { GreenAccentButton } from '@/shared/ui/buttons/green-accent-button'
import { DropdownButton } from '@/shared/ui/buttons/dropdown-button'
import { showToast } from '@/shared/ui/toast/show-toast'
import type { SelectOption } from '@/shared/types/select-option'

import { buildFallbackConfig } from '@/pages/documents/documents-entry/lib/utils/build-fallback-config'

import type { DictSidebarPanel } from '../types/dict-sidebar'
import { useDictSidebarStore } from '../lib/hooks/use-dict-sidebar-store'
import {
  fetchDictEntryById,
  createDictEntry,
  updateDictEntry,
  type DictEntry,
  type DictEntryCreatePayload,
} from '../api/dict-sidebar-api'

interface DictSidebarFormViewProps {
  panel: DictSidebarPanel
  typeData: DocumentType
  typeName: string
}

export const DictSidebarFormView = ({
  panel,
  typeData,
  typeName,
}: DictSidebarFormViewProps) => {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const { pop, updateTopTitle } = useDictSidebarStore()

  const [savedEntryId, setSavedEntryId] = useState<number | string | null>(
    panel.entryId ?? null
  )
  const isEdit = !!savedEntryId

  const form = useForm<Record<string, unknown>>()

  const { data: entryData, isLoading: isLoadingEntry } = useQuery<
    AxiosResponse<DictEntry>,
    Error,
    DictEntry
  >({
    queryKey: ['dict-sidebar-entry', panel.dataType, savedEntryId],
    queryFn: ({ signal }) =>
      fetchDictEntryById(panel.dataType, savedEntryId!, signal),
    enabled: !!savedEntryId,
    select: (res) => res.data,
  })

  useEffect(() => {
    if (!entryData) return
    const values: Record<string, unknown> = { ...entryData.attributes }
    values.nameRu = entryData.nameRu
    values.nameKz = entryData.nameKz
    values.code = entryData.code
    form.reset(values)

    const entryName =
      i18n.language === 'kz' && entryData.nameKz
        ? entryData.nameKz
        : entryData.nameRu
    updateTopTitle(
      t('dictSidebar.editTitle', { name: typeName, entry: entryName })
    )
  }, [entryData, form, i18n.language, t, typeName, updateTopTitle])

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

  const formConfig = useMemo(
    () => buildFallbackConfig(formAttributes),
    [formAttributes]
  )

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
      queryKey: ['dict-sidebar-entries', panel.dataType, panel.typeCode],
    })
    void queryClient.invalidateQueries({
      queryKey: ['dict-sidebar-entry', panel.dataType, savedEntryId],
    })
    void queryClient.invalidateQueries({
      queryKey: ['dictionary-search'],
    })
    void queryClient.invalidateQueries({
      queryKey: ['document-entries'],
    })
    void queryClient.invalidateQueries({
      queryKey: ['document-entry'],
    })
  }

  const buildSelectOption = (entry: DictEntry): SelectOption => ({
    id: entry.id,
    code: entry.code,
    label:
      entry.displayName ??
      (i18n.language === 'kz' && entry.nameKz ? entry.nameKz : entry.nameRu),
    raw: entry as unknown as Record<string, unknown>,
  })

  const createMutation = useMutation<
    AxiosResponse<DictEntry>,
    Error,
    Record<string, unknown>
  >({
    mutationFn: (data) =>
      createDictEntry(panel.dataType, panel.typeCode, buildPayload(data)),
    onSuccess: (res) => {
      const entry = res.data
      setSavedEntryId(entry.id)
      invalidateEntries()
      panel.onSelect?.(buildSelectOption(entry))
      showToast('success', t('dictSidebar.saved'))

      const entryName =
        i18n.language === 'kz' && entry.nameKz ? entry.nameKz : entry.nameRu
      updateTopTitle(
        t('dictSidebar.editTitle', { name: typeName, entry: entryName })
      )
    },
    onError: () => {
      showToast('error', t('dictSidebar.saveError'))
    },
  })

  const updateMutation = useMutation<
    AxiosResponse<DictEntry>,
    Error,
    Record<string, unknown>
  >({
    mutationFn: (data) =>
      updateDictEntry(panel.dataType, savedEntryId!, buildPayload(data)),
    onSuccess: (res) => {
      invalidateEntries()
      panel.onSelect?.(buildSelectOption(res.data))
      showToast('success', t('dictSidebar.saved'))
    },
    onError: () => {
      showToast('error', t('dictSidebar.saveError'))
    },
  })

  const isSaving = createMutation.isPending || updateMutation.isPending

  const handleSave = form.handleSubmit((data) => {
    if (isEdit) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data)
    }
  })

  const handleSaveAndClose = form.handleSubmit((data) => {
    const onDone = (entry: DictEntry) => {
      invalidateEntries()
      panel.onSelect?.(buildSelectOption(entry))
      pop()
    }

    if (isEdit) {
      void updateDictEntry(panel.dataType, savedEntryId, buildPayload(data))
        .then((res) => {
          onDone(res.data)
        })
        .catch(() => {
          showToast('error', t('dictSidebar.saveError'))
        })
    } else {
      void createDictEntry(panel.dataType, panel.typeCode, buildPayload(data))
        .then((res) => {
          onDone(res.data)
        })
        .catch(() => {
          showToast('error', t('dictSidebar.saveError'))
        })
    }
  })

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-hidden pt-6">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <GreenAccentButton
          type="button"
          disabled={isSaving}
          onClick={handleSaveAndClose}
        >
          {t('dictSidebar.saveAndClose')}
        </GreenAccentButton>
        <button
          type="button"
          disabled={isSaving}
          onClick={handleSave}
          className="cursor-pointer whitespace-nowrap rounded-md bg-ui-01 px-4 py-2.5 text-body2 text-ui-06 hover:bg-ui-01/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('dictSidebar.save')}
        </button>
        <DropdownButton label={t('actions.more')} disabled />
      </div>

      {/* Form */}
      <div className="min-h-0 flex-1 overflow-auto pb-2">
        {isLoadingEntry ? null : (
          <FormRenderer
            config={formConfig}
            attributes={formAttributes}
            form={form}
            typeCode={panel.typeCode}
          />
        )}
      </div>
    </div>
  )
}
