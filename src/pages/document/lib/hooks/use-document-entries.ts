import { useSuspenseQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'

import { documentTypeApi } from '../../api/document-type'
import type { DocumentEntriesResponseData } from '../../types/document-type'

export const useDocumentEntries = () => {
  const { moduleCode = '' } = useParams<{
    pageCode: string
    moduleCode: string
  }>()

  const { data } = useSuspenseQuery({
    queryKey: ['document-entries', moduleCode],
    queryFn: () => documentTypeApi.getDocumentEntries(moduleCode),
    select: (response) => (response.data as DocumentEntriesResponseData).data,
  })

  return data
}
