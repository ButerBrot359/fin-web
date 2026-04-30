import { useSuspenseInfiniteQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'

import { getDocumentEntries } from '../../api/document-entry'
import type { DocumentEntry } from '../../types/document-entry'

const PAGE_SIZE = 25

interface UseDocumentEntriesResult {
  entries: DocumentEntry[]
  totalElements: number
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
}

export const useDocumentEntries = (): UseDocumentEntriesResult => {
  const { moduleCode = '' } = useParams<{
    pageCode: string
    moduleCode: string
  }>()

  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useSuspenseInfiniteQuery({
      queryKey: ['document-entries', moduleCode],
      queryFn: ({ pageParam }) =>
        getDocumentEntries(moduleCode, { page: pageParam, size: PAGE_SIZE }),
      initialPageParam: 0,
      getNextPageParam: (lastPage) => {
        const paged = lastPage.data.data
        return paged.last ? undefined : paged.number + 1
      },
    })

  const entries = data.pages.flatMap((page) => page.data.data.content)
  const totalElements = data.pages[0]?.data.data.totalElements ?? 0

  return {
    entries,
    totalElements,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage: () => {
      void fetchNextPage()
    },
  }
}
