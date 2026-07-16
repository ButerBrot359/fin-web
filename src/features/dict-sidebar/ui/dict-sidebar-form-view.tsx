import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'
import type { AxiosResponse } from 'axios'

import type { DocumentType, DocumentAttribute } from '@/entities/document-type'
import type { ApiResponse } from '@/shared/types/api.types'
import { FormRenderer } from '@/features/form-renderer'
import { SubkontoTab } from '@/pages/account-plan/account-plan-entry/ui/subkonto-tab'
import { Button } from '@/shared/ui/buttons/button'
import { DropdownButton } from '@/shared/ui/buttons/dropdown-button'
import { showToast } from '@/shared/ui/toast/show-toast'
import type { SelectOption } from '@/shared/types/select-option'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'

import { buildFallbackConfig } from '@/pages/documents/documents-entry/lib/utils/build-fallback-config'
import { moveTablesLast } from '../lib/utils/move-tables-last'

import type { DictSidebarPanel } from '../types/dict-sidebar'
import { useDictSidebarStore } from '../lib/hooks/use-dict-sidebar-store'
import {
  fetchDictEntryById,
  createDictEntry,
  updateDictEntry,
  type DictEntry,
  type DictEntryCreatePayload,
} from '../api/dict-sidebar-api'

/** Домен плана счетов — карточка счёта (а не обычный справочник). */
const ACCOUNT_PLAN_DOMAIN = 'ACCOUNT_PLAN'

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
    AxiosResponse<ApiResponse<DictEntry>>,
    Error,
    DictEntry
  >({
    queryKey: ['dict-sidebar-entry', panel.domain, savedEntryId],
    queryFn: ({ signal }) =>
      fetchDictEntryById(panel.domain, savedEntryId!, signal),
    enabled: !!savedEntryId,
    select: (res) => res.data.data,
  })

  const { data: copyFromData, isLoading: isLoadingCopy } = useQuery<
    AxiosResponse<ApiResponse<DictEntry>>,
    Error,
    DictEntry
  >({
    queryKey: ['dict-sidebar-entry', panel.domain, panel.copyFromId],
    queryFn: ({ signal }) =>
      fetchDictEntryById(panel.domain, panel.copyFromId!, signal),
    enabled: !savedEntryId && !!panel.copyFromId,
    select: (res) => res.data.data,
  })

  useEffect(() => {
    if (!entryData) return
    const values: Record<string, unknown> = { ...entryData.attributes }
    values.nameRu = entryData.nameRu
    values.nameKz = entryData.nameKz
    values.code = entryData.code
    form.reset(values)

    updateTopTitle(
      t('dictSidebar.editTitle', {
        name: typeName,
        entry: getLocalizedName(entryData, i18n.language),
      })
    )
  }, [entryData, form, i18n.language, t, typeName, updateTopTitle])

  useEffect(() => {
    if (!copyFromData || savedEntryId) return
    const { Nomer: _, Kod: _k, ...restAttrs } = (copyFromData.attributes ?? {})
    const values: Record<string, unknown> = { ...restAttrs }
    values.nameRu = copyFromData.nameRu
    values.nameKz = copyFromData.nameKz

    form.reset({})
    for (const [key, value] of Object.entries(values)) {
      form.setValue(key, value, { shouldDirty: true })
    }
  }, [copyFromData, savedEntryId, form])

  // Предзаполнение формы создания дефолтами из панели (напр. Vladelets = контрагент
  // документа при создании нового договора). Только режим создания — не
  // редактирование (entryId) и не копирование (copyFromId). Одноразово.
  const seededDefaultsRef = useRef(false)
  useEffect(() => {
    if (savedEntryId || panel.copyFromId || seededDefaultsRef.current) return
    if (!panel.defaults) return
    seededDefaultsRef.current = true
    for (const [key, value] of Object.entries(panel.defaults)) {
      form.setValue(key, value, { shouldDirty: true })
    }
  }, [panel.defaults, panel.copyFromId, savedEntryId, form])

  // План счетов: «Подчинён счёту» — встроенное поле сущности (parentName),
  // а виды субконто — отдельная коллекция (subkontoKinds), показываемая своей
  // таблицей. Поэтому для ACCOUNT_PLAN не рендерим generic TABLE-атрибуты
  // (они отображались криво — только номера строк).
  const isAccountPlan = panel.domain === ACCOUNT_PLAN_DOMAIN

  const formAttributes = useMemo(
    () =>
      [...typeData.attributes]
        .filter((attr: DocumentAttribute) => attr.showInForm)
        .filter(
          (attr: DocumentAttribute) =>
            // Для плана счетов прячем generic TABLE-атрибуты (субконто рисуем
            // своей таблицей) и служебный EAV-атрибут «Kod» (внутренний код
            // вида 000000013) — настоящий код счёта показываем из встроенного
            // поля `code` отдельным блоком ниже.
            !(
              isAccountPlan &&
              (attr.dataType === 'TABLE' || attr.code === 'Kod')
            )
        )
        .sort(
          (a: DocumentAttribute, b: DocumentAttribute) =>
            a.sortOrder - b.sortOrder
        ),
    [typeData.attributes, isAccountPlan]
  )

  const formConfig = useMemo(
    () => moveTablesLast(buildFallbackConfig(formAttributes), formAttributes),
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
      queryKey: ['dict-sidebar-entries', panel.domain, panel.typeCode],
    })
    void queryClient.invalidateQueries({
      queryKey: ['dict-sidebar-entry', panel.domain, savedEntryId],
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
    label: entry.displayName ?? getLocalizedName(entry, i18n.language),
    raw: entry as unknown as Record<string, unknown>,
  })

  const createMutation = useMutation<
    AxiosResponse<ApiResponse<DictEntry>>,
    Error,
    Record<string, unknown>
  >({
    mutationFn: (data) =>
      createDictEntry(panel.domain, panel.typeCode, buildPayload(data)),
    onSuccess: (res, data) => {
      form.reset(data)
      const entry = res.data.data
      setSavedEntryId(entry.id)
      invalidateEntries()
      panel.onSelect?.(buildSelectOption(entry))
      showToast('success', t('dictSidebar.saved'))

      updateTopTitle(
        t('dictSidebar.editTitle', {
          name: typeName,
          entry: getLocalizedName(entry, i18n.language),
        })
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
      updateDictEntry(panel.domain, savedEntryId!, buildPayload(data)),
    onSuccess: (res, data) => {
      form.reset(data)
      invalidateEntries()
      panel.onSelect?.(buildSelectOption(res.data.data))
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
      void updateDictEntry(panel.domain, savedEntryId, buildPayload(data))
        .then((res) => {
          onDone(res.data.data)
        })
        .catch(() => {
          showToast('error', t('dictSidebar.saveError'))
        })
    } else {
      void createDictEntry(panel.domain, panel.typeCode, buildPayload(data))
        .then((res) => {
          onDone(res.data.data)
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

      {/* Form */}
      <div className="min-h-0 flex-1 overflow-auto pb-2">
        {isLoadingEntry || isLoadingCopy ? null : (
          <>
            {isAccountPlan && (
              <div className="mb-4 flex flex-col gap-1 text-sm">
                <span className="text-ui-05">
                  {t('accountPlan.field.parent')}
                </span>
                <span className="rounded-md border border-ui-03 bg-ui-02 px-3 py-1.5 text-ui-06">
                  {entryData?.parentName ?? t('accountPlan.notSet')}
                </span>
              </div>
            )}
            {/* Настоящий код счёта (встроенное поле `code`), а не служебный
                EAV-атрибут «Kod» (внутренний код 000000013). */}
            {isAccountPlan && (
              <label className="mb-4 flex flex-col gap-1 text-sm">
                <span className="text-ui-05">{t('accountPlan.field.code')}</span>
                <input
                  className="rounded-md border border-ui-03 bg-ui-01 px-3 py-1.5 text-ui-06"
                  {...form.register('code')}
                />
              </label>
            )}
            <FormRenderer
              config={formConfig}
              attributes={formAttributes}
              form={form}
              typeCode={panel.typeCode}
              domain={panel.domain}
            />
            {/* Виды субконто счёта — отдельная read-only таблица (как в 1С):
                Вид субконто · Только обороты · Суммовой · Валютный · Количественный. */}
            {isAccountPlan && savedEntryId != null && (
              <div className="mt-4">
                <Typography
                  variant="body2"
                  className="mb-2 font-medium text-ui-06"
                >
                  {t('accountPlan.tabs.subconto')}
                </Typography>
                <SubkontoTab accountId={Number(savedEntryId)} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
