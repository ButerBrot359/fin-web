import { useSuspenseQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

import { documentTypeApi } from '../../api/document-type'
import type { DocumentTypeResponseData } from '../../types/document-type'

export const useDocumentType = () => {
  const { moduleCode = '' } = useParams<{
    pageCode: string
    moduleCode: string
  }>()
  const { i18n } = useTranslation()

  const { data } = useSuspenseQuery({
    queryKey: ['document-types', moduleCode],
    queryFn: () => documentTypeApi.getDocumentType(moduleCode),
    staleTime: 5 * 60 * 1000,
    select: (response) => (response.data as DocumentTypeResponseData).data,
  })

  const title =
    i18n.language === 'kz' ? data.nameKz || data.nameRu : data.nameRu

  return { ...data, title }
}
