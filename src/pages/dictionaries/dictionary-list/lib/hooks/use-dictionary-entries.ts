import { useMemo } from 'react'
import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query'

import {
  fetchDictEntriesPaged,
  type DictEntry,
} from '@/features/dict-sidebar/api/dict-sidebar-api'

const PAGE_SIZE = 25

interface UseDictionaryEntriesResult {
  entries: DictEntry[]
  totalElements: number
  isLoading: boolean
  isSortingOrFiltering: boolean
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
}

export const useDictionaryEntries = (
  domain: string,
  typeCode: string,
  skipDependsOn?: boolean,
  sortAttr?: string,
  sortDir?: string
): UseDictionaryEntriesResult => {
  const {
    data,
    isLoading,
    isFetching,
    isPlaceholderData,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: [
      'dict-entries',
      domain,
      typeCode,
      skipDependsOn,
      sortAttr,
      sortDir,
    ],
    queryFn: ({ pageParam, signal }) =>
      fetchDictEntriesPaged(
        domain,
        typeCode,
        {
          page: pageParam,
          size: PAGE_SIZE,
          ...(skipDependsOn && { skipDependsOn: true }),
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
    staleTime: 60 * 1000,
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
