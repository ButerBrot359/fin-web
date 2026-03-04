import type { AxiosResponse } from 'axios'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'

import { documentService } from '../../api/document'
import type {
  DocumentEntriesResponseData,
  DocumentEntry,
} from '../../types/document-type'

export const useDocumentEntries = (): DocumentEntry[] => {
  const { moduleCode = '' } = useParams<{
    pageCode: string
    moduleCode: string
  }>()

  const { data } = useSuspenseQuery<
    AxiosResponse<unknown>,
    Error,
    DocumentEntry[]
  >({
    queryKey: ['document-entries', moduleCode],
    queryFn: () => documentService.getDocumentEntries(moduleCode),
    select: (response): DocumentEntry[] => {
      const body = response.data as DocumentEntriesResponseData

      return body.data.content
    },
  })

  return data
}
