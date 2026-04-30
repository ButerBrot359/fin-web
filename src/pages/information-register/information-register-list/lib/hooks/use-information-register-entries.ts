import { useInfiniteQuery } from '@tanstack/react-query'

import { getInformationRegisterEntries } from '../../api/information-register-api'
import type { InformationRegisterEntry } from '../../types/information-register'

const PAGE_SIZE = 25

interface UseInformationRegisterEntriesResult {
  entries: InformationRegisterEntry[]
  totalElements: number
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
  isLoading: boolean
}

export const useInformationRegisterEntries = (
  domain: string,
  typeCode: string
): UseInformationRegisterEntriesResult => {
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ['information-register-entries', domain, typeCode],
      queryFn: ({ pageParam }) =>
        getInformationRegisterEntries(domain, typeCode, {
          page: pageParam,
          size: PAGE_SIZE,
        }),
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
