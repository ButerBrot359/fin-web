import { useInfiniteQuery } from '@tanstack/react-query'

import {
  fetchDictEntriesPaged,
  type DictEntry,
} from '@/features/dict-sidebar/api/dict-sidebar-api'

const PAGE_SIZE = 25

interface UseDictionaryEntriesResult {
  entries: DictEntry[]
  totalElements: number
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
  isLoading: boolean
}

export const useDictionaryEntries = (
  domain: string,
  typeCode: string,
  skipDependsOn?: boolean
): UseDictionaryEntriesResult => {
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ['dict-entries', domain, typeCode, skipDependsOn],
      queryFn: ({ pageParam, signal }) =>
        fetchDictEntriesPaged(
          domain,
          typeCode,
          {
            page: pageParam,
            size: PAGE_SIZE,
            ...(skipDependsOn && { skipDependsOn: true }),
          },
          signal
        ),
      initialPageParam: 0,
      getNextPageParam: (lastPage) => {
        const paged = lastPage.data.data
        return paged.last ? undefined : paged.number + 1
      },
      staleTime: 60 * 1000,
    })

  const entries = data?.pages.flatMap((page) => page.data.data.content) ?? []
  const totalElements = data?.pages[0]?.data.data.totalElements ?? 0

  return {
    entries,
    totalElements,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage: () => {
      void fetchNextPage()
    },
    isLoading,
  }
}
