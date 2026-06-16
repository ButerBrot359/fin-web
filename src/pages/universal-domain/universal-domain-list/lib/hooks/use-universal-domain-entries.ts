import { useCallback, useMemo } from 'react'
import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query'

import { fetchUniversalDomainEntries } from '../../api/universal-domain-api'
import type { UniversalDomainEntry } from '../../types/universal-domain'

const PAGE_SIZE = 25
const EXPORT_PAGE_SIZE = 200
/** Предохранитель от бесконечного цикла, если бэк не выставит `last`. */
const EXPORT_MAX_PAGES = 1000

interface UseUniversalDomainEntriesOptions {
  sortAttr?: string
  sortDir?: string
}

/**
 * Инфинит-листинг записей универсального домена через GET `/search?q=`. По
 * форме страницы (`content` / `totalElements` / `number` / `last`) совпадает с
 * EAV, поэтому подходит для `EavEntityTable`.
 */
export const useUniversalDomainEntries = (
  domain: string,
  typeCode: string,
  options: UseUniversalDomainEntriesOptions = {}
) => {
  const { sortAttr, sortDir } = options

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
    queryKey: ['universal-domain-entries', domain, typeCode, sortAttr, sortDir],
    queryFn: ({ pageParam, signal }) =>
      fetchUniversalDomainEntries(
        domain,
        typeCode,
        { page: pageParam, size: PAGE_SIZE, sortAttr, sortDir },
        signal
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const paged = lastPage.data.data
      return paged.last ? undefined : paged.number + 1
    },
    placeholderData: keepPreviousData,
    enabled: !!domain && !!typeCode,
  })

  const entries = useMemo(
    () => data?.pages.flatMap((page) => page.data.data.content) ?? [],
    [data]
  )
  const reportedTotal = data?.pages[0]?.data.data.totalElements
  const totalElements =
    typeof reportedTotal === 'number' ? reportedTotal : entries.length

  const fetchAllEntries = useCallback(async (): Promise<
    UniversalDomainEntry[]
  > => {
    const all: UniversalDomainEntry[] = []
    let page = 0
    for (;;) {
      const res = await fetchUniversalDomainEntries(domain, typeCode, {
        page,
        size: EXPORT_PAGE_SIZE,
        sortAttr,
        sortDir,
      })
      const paged = res.data.data
      all.push(...paged.content)
      if (paged.last || page >= EXPORT_MAX_PAGES) break
      page = paged.number + 1
    }
    return all
  }, [domain, typeCode, sortAttr, sortDir])

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
    fetchAllEntries,
  }
}
