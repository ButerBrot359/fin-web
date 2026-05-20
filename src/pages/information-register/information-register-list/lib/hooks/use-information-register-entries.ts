import { useMemo } from 'react'
import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query'

import { getInformationRegisterEntries } from '../../api/information-register-api'
import type { InformationRegisterEntry } from '../../types/information-register'

const PAGE_SIZE = 25

interface UseInformationRegisterEntriesResult {
  entries: InformationRegisterEntry[]
  totalElements: number
  isLoading: boolean
  isSortingOrFiltering: boolean
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
}

export const useInformationRegisterEntries = (
  domain: string,
  typeCode: string,
  sortAttr?: string,
  sortDir?: string,
  enabled = true
): UseInformationRegisterEntriesResult => {
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
      'information-register-entries',
      domain,
      typeCode,
      sortAttr,
      sortDir,
    ],
    queryFn: ({ pageParam }) =>
      getInformationRegisterEntries(domain, typeCode, {
        page: pageParam,
        size: PAGE_SIZE,
        sortAttr,
        sortDir,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const paged = lastPage.data.data
      return paged.last ? undefined : paged.number + 1
    },
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
    enabled: enabled && !!typeCode,
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
