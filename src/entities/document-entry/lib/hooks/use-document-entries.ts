import { useMemo } from 'react'
import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'

import { searchDocumentEntries } from '../../api/document-entry'
import type { DocumentEntry } from '../../types/document-entry'
import type { FilterRequest } from '../../types/filter'

const PAGE_SIZE = 25
const EMPTY_FILTER: FilterRequest = { filters: [], logic: 'AND' }

interface UseDocumentEntriesResult {
  entries: DocumentEntry[]
  totalElements: number
  isLoading: boolean
  isSortingOrFiltering: boolean
  isError: boolean
  error: unknown
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
}

export const useDocumentEntries = (
  sortAttr?: string,
  sortDir?: string,
  filter: FilterRequest = EMPTY_FILTER
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
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ['document-entries', moduleCode, sortAttr, sortDir, filter],
    queryFn: ({ pageParam, signal }) =>
      searchDocumentEntries(
        moduleCode,
        filter,
        {
          page: pageParam,
          size: PAGE_SIZE,
          sortAttr,
          sortDir,
        },
        signal
      ),
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
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage: () => {
      void fetchNextPage()
    },
  }
}
