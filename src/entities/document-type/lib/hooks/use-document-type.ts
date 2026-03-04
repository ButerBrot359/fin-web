import { useSuspenseQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import {
  getDocumentType,
  type DocumentTypeResponseData,
} from '@/entities/document-type'

export const useDocumentType = (moduleCode: string) => {
  const { i18n } = useTranslation()

  const { data } = useSuspenseQuery({
    queryKey: ['document-types', moduleCode],
    queryFn: () => getDocumentType(moduleCode),
    staleTime: 5 * 60 * 1000,
    select: (response) => (response.data as DocumentTypeResponseData).data,
  })

  const title =
    i18n.language === 'kz' ? data.nameKz || data.nameRu : data.nameRu

  return { ...data, title }
}
