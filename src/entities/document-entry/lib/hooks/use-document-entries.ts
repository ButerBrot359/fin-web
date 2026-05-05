import { useMemo } from 'react'
import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'

import { getDocumentEntries } from '../../api/document-entry'
import type { DocumentEntry } from '../../types/document-entry'

const PAGE_SIZE = 25

interface UseDocumentEntriesResult {
  entries: DocumentEntry[]
  totalElements: number
  isLoading: boolean
  isSortingOrFiltering: boolean
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
}

export const useDocumentEntries = (
  sort?: string[]
): UseDocumentEntriesResult => {
  const { moduleCode = '' } = useParams<{
    pageCode: string
    moduleCode: string
  }>()

  const {
    data,
    isLoading,
    isFetching,
    isPlaceholderData,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ['document-entries', moduleCode, sort],
    queryFn: ({ pageParam }) =>
      getDocumentEntries(moduleCode, {
        page: pageParam,
        size: PAGE_SIZE,
        sort,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const paged = lastPage.data.data
      return paged.last ? undefined : paged.number + 1
    },
    placeholderData: keepPreviousData,
  })

  const entries = useMemo(
    () => data?.pages.flatMap((page) => page.data.data.content) ?? [],
    [data]
  )
  const totalElements = data?.pages[0]?.data.data.totalElements ?? 0

  return {
    entries,
    totalElements,
    isLoading,
    isSortingOrFiltering: isFetching && isPlaceholderData,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage: () => {
      void fetchNextPage()
    },
  }
}
