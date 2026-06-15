import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import type { SelectOption } from '@/shared/types/select-option'

import {
  fetchDvizheniyaFinansirovaniya,
  fetchIstochnikiFinansirovaniya,
  fetchOrganizations,
  fetchVidyPlana,
  type DictionarySearchEntry,
} from '../../api/financing-plan-upload-api'
import { VID_PLANA_PO_OBYAZATELSTVAM } from '../../types/financing-plan-upload'

/** Запись справочника → SelectOption (двуязычная подпись). */
const dictEntryToOption = (
  entry: DictionarySearchEntry,
  language: string
): SelectOption => {
  const name =
    language === 'kz' && entry.nameKz
      ? entry.nameKz
      : (entry.displayName ?? entry.nameRu ?? entry.code ?? String(entry.id))
  return {
    id: entry.id,
    code: entry.code ?? '',
    label: entry.code ? `${entry.code} — ${name}` : name,
  }
}

/** Активные организации для автокомплита «Организация». */
export const useOrganizations = () => {
  const { i18n } = useTranslation()
  const { data } = useQuery({
    queryKey: ['organizations', 'active'],
    queryFn: ({ signal }) => fetchOrganizations(signal),
    select: (res) => res.data,
    staleTime: 5 * 60 * 1000,
  })

  const options = useMemo<SelectOption[]>(
    () =>
      (data ?? []).map((o) => {
        const name =
          i18n.language === 'kz' && o.nameKz
            ? o.nameKz
            : (o.displayName ?? o.nameRu ?? o.code ?? String(o.id))
        return {
          id: o.id,
          code: o.code ?? '',
          label: name,
        }
      }),
    [data, i18n.language]
  )

  return { organizationOptions: options }
}

/**
 * Виды плана финансирования (enum). MVP: реально поддержан только
 * «по обязательствам» — остальные значения скрываем, чтобы не дать выбрать
 * неподдерживаемый вид.
 */
export const useVidyPlana = () => {
  const { data } = useQuery({
    queryKey: ['enum-values', 'VidyPlanaFinansirovaniya'],
    queryFn: ({ signal }) => fetchVidyPlana(signal),
    select: (res) => res.data,
    staleTime: 5 * 60 * 1000,
  })

  const vidPlanaOptions = useMemo<SelectOption[]>(
    () =>
      (data ?? [])
        .filter((v) => v.code === VID_PLANA_PO_OBYAZATELSTVAM)
        .map((v) => ({ id: v.id, code: v.code, label: v.name })),
    [data]
  )

  return { vidPlanaOptions }
}

/** Виды источников финансирования (справочник). */
export const useIstochnikiFinansirovaniya = () => {
  const { i18n } = useTranslation()
  const { data } = useQuery({
    queryKey: ['dictionary-entries-active', 'VidyIstochnikovFinansirovaniya'],
    queryFn: ({ signal }) => fetchIstochnikiFinansirovaniya(signal),
    select: (res) => res.data.data.content,
    staleTime: 5 * 60 * 1000,
  })

  const istochnikOptions = useMemo<SelectOption[]>(
    () => (data ?? []).map((e) => dictEntryToOption(e, i18n.language)),
    [data, i18n.language]
  )

  return { istochnikOptions }
}

/** Движения финансирования (справочник). */
export const useDvizheniyaFinansirovaniya = () => {
  const { i18n } = useTranslation()
  const { data } = useQuery({
    queryKey: ['dictionary-entries-active', 'DvizheniyaFinansirovaniya'],
    queryFn: ({ signal }) => fetchDvizheniyaFinansirovaniya(signal),
    select: (res) => res.data.data.content,
    staleTime: 5 * 60 * 1000,
  })

  const dvizhenieOptions = useMemo<SelectOption[]>(
    () => (data ?? []).map((e) => dictEntryToOption(e, i18n.language)),
    [data, i18n.language]
  )

  return { dvizhenieOptions }
}
