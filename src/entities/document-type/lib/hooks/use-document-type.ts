import { useSuspenseQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { getDocumentType } from '@/entities/document-type'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'

export const useDocumentType = (moduleCode: string) => {
  const { i18n } = useTranslation()

  const { data } = useSuspenseQuery({
    queryKey: ['document-types', moduleCode],
    queryFn: () => getDocumentType(moduleCode),
    staleTime: 5 * 60 * 1000,
    select: (response) => response.data.data,
  })

  const title = getLocalizedName(data, i18n.language)

  return { ...data, title }
}
