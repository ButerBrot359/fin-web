import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { fetchDictTypeMetadata } from '@/features/dict-sidebar/api/dict-sidebar-api'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'

export const useDictionaryType = (domain: string, typeCode: string) => {
  const { i18n } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: ['dict-type', domain, typeCode],
    queryFn: ({ signal }) => fetchDictTypeMetadata(domain, typeCode, signal),
    staleTime: 5 * 60 * 1000,
    select: (res) => res.data.data,
  })

  const title = data ? getLocalizedName(data, i18n.language) : ''

  return {
    title,
    attributes: data?.attributes ?? [],
    typeData: data,
    isLoading,
  }
}
