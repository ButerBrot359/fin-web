import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import type { SelectOption } from '@/shared/types/select-option'

import {
  fetchDvizheniyaFinansirovaniya,
  fetchIstochnikiFinansirovaniya,
  fetchVidyPlana,
  searchOrganizations,
  type DictionarySearchEntry,
} from '../../api/financing-plan-upload-api'

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

/** Задержка debounce серверного поиска организаций, мс. */
const ORG_SEARCH_DEBOUNCE_MS = 300

/** EAV-атрибуты «полное наименование» справочника Organizatsii. */
const ATTR_NAIMENOVANIE_POLNOE_RUS = 'NaimenovaniePolnoeRus'
const ATTR_NAIMENOVANIE_POLNOE_KAZ = 'NaimenovaniePolnoeKaz'

/**
 * Организации для автокомплита «Организация» — серверный поиск по вводу
 * (Filter DSL, как грид справочника), а не загрузка всего справочника.
 * Запрос стартует только после открытия списка (`onOrganizationOpen`),
 * чтобы не дёргать бэк на маунте.
 */
export const useOrganizations = () => {
  const { i18n } = useTranslation()
  const [opened, setOpened] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(inputValue)
    }, ORG_SEARCH_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [inputValue])

  const { data, isFetching } = useQuery({
    queryKey: ['organizations', 'search', debouncedSearch],
    queryFn: ({ signal }) => searchOrganizations(debouncedSearch, signal),
    select: (res) => res.data.data.content,
    enabled: opened,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  })

  const organizationOptions = useMemo<SelectOption[]>(
    () =>
      (data ?? []).map((entry) => {
        const isKz = i18n.language === 'kz'
        // Подпись = полное наименование (рус./каз. по языку), как колонка
        // «Полное наименование» грида справочника — оно различает записи с
        // одинаковым nameRu. Без префикса кода (id/code остаются значением опции).
        const fullNameRaw =
          entry.attributes?.[
            isKz ? ATTR_NAIMENOVANIE_POLNOE_KAZ : ATTR_NAIMENOVANIE_POLNOE_RUS
          ]
        const fullName =
          typeof fullNameRaw === 'string' && fullNameRaw.trim()
            ? fullNameRaw
            : null
        // null/пусто → fallback на nameRu/nameKz (по языку), затем общие fallbacks.
        const fallback = isKz ? entry.nameKz : entry.nameRu
        const label =
          fullName ??
          fallback ??
          entry.nameRu ??
          entry.displayName ??
          entry.code ??
          String(entry.id)
        return { id: entry.id, code: entry.code ?? '', label }
      }),
    [data, i18n.language]
  )

  return {
    organizationOptions,
    organizationInputValue: inputValue,
    isOrganizationsLoading: isFetching,
    onOrganizationOpen: () => {
      setOpened(true)
    },
    setOrganizationInputValue: setInputValue,
    onOrganizationInputChange: (
      _event: unknown,
      value: string,
      reason: string
    ) => {
      // 'reset' прилетает при выборе опции — игнорируем, чтобы не искать по
      // полному label выбранной записи (его проставляем явно в onChange).
      if (reason !== 'reset') {
        setInputValue(value)
      }
    },
  }
}

/**
 * Виды плана финансирования (enum). Список data-driven — отражает ответ
 * эндпоинта (и «по обязательствам», и «по платежам»), без фильтрации на клиенте.
 */
export const useVidyPlana = () => {
  const { data } = useQuery({
    queryKey: ['enum-values', 'VidyPlanaFinansirovaniya'],
    queryFn: ({ signal }) => fetchVidyPlana(signal),
    select: (res) => res.data,
    staleTime: 5 * 60 * 1000,
  })

  const vidPlanaOptions = useMemo<SelectOption[]>(
    () => (data ?? []).map((v) => ({ id: v.id, code: v.code, label: v.name })),
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
