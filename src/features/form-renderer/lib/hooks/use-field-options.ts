import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import type { DocumentAttribute } from '@/entities/document-type'
import { apiService } from '@/shared/api/api'
import {
  REFERENCE_DOMAIN_KINDS,
  getUniversalSearchUrl,
  resolveAttributeDomain,
} from '@/shared/lib/consts/data-types'
import type { SelectOption } from '@/shared/types/select-option'

interface DictionaryEntry {
  id: number
  code: string
  nameRu: string
  nameKz: string
  [key: string]: unknown
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

interface UseFieldOptionsParams {
  attributes: DocumentAttribute[]
  dependencyMap: Map<string, unknown>
}

export const useFieldOptions = ({
  attributes,
  dependencyMap,
}: UseFieldOptionsParams) => {
  const { i18n } = useTranslation()

  const referenceAttributes = useMemo(
    () =>
      attributes.filter((attr) => {
        const resolved = resolveAttributeDomain(attr)
        if (!resolved || !REFERENCE_DOMAIN_KINDS.has(resolved.domain))
          return false
        // Skip fields with dependencies — they use dynamic search with af param
        return !dependencyMap.has(attr.code)
      }),
    [attributes, dependencyMap]
  )

  const dictionaryQueries = useQueries({
    queries: referenceAttributes.map((attr) => {
      const resolved = resolveAttributeDomain(attr)!
      return {
        queryKey: [
          'dictionary-entries-active',
          resolved.domain,
          resolved.typeCode,
        ],
        queryFn: () =>
          apiService.get<{ content: DictionaryEntry[] }>({
            url: getUniversalSearchUrl(resolved.domain, resolved.typeCode),
            params: { q: '', size: 1000 },
          }),
        staleTime: 5 * 60 * 1000,
      }
    }),
  })

  const optionsMap = useMemo(() => {
    const map: Record<string, SelectOption[]> = {}

    referenceAttributes.forEach((attr, index) => {
      const query = dictionaryQueries[index]
      const content = query.data?.data.content
      if (content) {
        map[attr.code] = content.map((entry) =>
          toSelectOption(entry, i18n.language)
        )
      }
    })

    return map
  }, [referenceAttributes, dictionaryQueries, i18n.language])

  return { optionsMap }
}
