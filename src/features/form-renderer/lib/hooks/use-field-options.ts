import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import type {
  DocumentAttribute,
  OnGetFormField,
} from '@/entities/document-type'
import { apiService } from '@/shared/api/api'
import type { SelectOption } from '@/shared/types/select-option'

interface DictionaryEntry {
  id: number
  code: string
  nameRu: string
  nameKz: string
  [key: string]: unknown
}

interface DictionaryEntriesResponse {
  data: DictionaryEntry[]
  success: boolean
}

const toSelectOption = (
  entry: DictionaryEntry,
  language: string
): SelectOption => ({
  id: entry.id,
  code: entry.code,
  label: language === 'kz' && entry.nameKz ? entry.nameKz : entry.nameRu,
  raw: entry as unknown as Record<string, unknown>,
})

const enumToSelectOption = (item: {
  id: number
  code: string
  name: string
  [key: string]: unknown
}): SelectOption => ({
  id: item.id,
  code: item.code,
  label: item.name,
  raw: item as unknown as Record<string, unknown>,
})

interface UseFieldOptionsParams {
  attributes: DocumentAttribute[]
  onGetFormData?: OnGetFormField[]
}

export const useFieldOptions = ({
  attributes,
  onGetFormData,
}: UseFieldOptionsParams) => {
  const { i18n } = useTranslation()

  const enumOptionsMap = useMemo(() => {
    const map: Record<string, SelectOption[]> = {}
    if (!onGetFormData) return map

    for (const field of onGetFormData) {
      map[field.fieldName] = field.elements.map(enumToSelectOption)
    }

    return map
  }, [onGetFormData])

  const dictionaryAttributes = useMemo(
    () =>
      attributes.filter(
        (attr) =>
          (attr.dataType === 'DICTIONARY' ||
            attr.dataType === 'REFERENCE' ||
            attr.dataType === 'ACCOUNT_PLAN') &&
          attr.referenceTypeCode
      ),
    [attributes]
  )

  const dictionaryQueries = useQueries({
    queries: dictionaryAttributes.map((attr) => ({
      queryKey: ['dictionary-entries-active', attr.referenceTypeCode],
      queryFn: () =>
        apiService.get<DictionaryEntriesResponse>({
          url: `/api/dictionaries/${attr.referenceTypeCode!}/entries/active`,
        }),
      staleTime: 5 * 60 * 1000,
    })),
  })

  const optionsMap = useMemo(() => {
    const map: Record<string, SelectOption[]> = { ...enumOptionsMap }

    dictionaryAttributes.forEach((attr, index) => {
      const query = dictionaryQueries[index]
      if (query.data) {
        map[attr.code] = query.data.data.data.map((entry) =>
          toSelectOption(entry, i18n.language)
        )
      }
    })

    return map
  }, [enumOptionsMap, dictionaryAttributes, dictionaryQueries, i18n.language])

  return { optionsMap }
}
