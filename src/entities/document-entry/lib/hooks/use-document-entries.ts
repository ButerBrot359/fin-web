import { useSuspenseQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'

import { getDocumentEntries } from '../../api/document-entry'
import type { DocumentEntry } from '../../types/document-entry'

export const useDocumentEntries = (): DocumentEntry[] => {
  const { moduleCode = '' } = useParams<{
    pageCode: string
    moduleCode: string
  }>()

  const { data } = useSuspenseQuery({
    queryKey: ['document-entries', moduleCode],
    queryFn: () => getDocumentEntries(moduleCode),
    select: (response) => response.data.data.content,
  })

  return data
}
