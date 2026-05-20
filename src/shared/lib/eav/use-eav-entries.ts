import { useMemo } from 'react'
import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query'

import { searchEavEntries } from './api'
import type { EavDomainConfig } from './domain-config'
import type { FilterRequest } from './types'

const PAGE_SIZE = 25
const EMPTY_FILTER: FilterRequest = { filters: [], logic: 'AND' }

interface UseEavEntriesOptions {
  sortAttr?: string
  sortDir?: string
  filter?: FilterRequest
  /**
   * Дополнительные query-параметры, специфичные для домена (например,
   * `parent` для иерархических справочников). Включаются в queryKey,
   * добавляются к URL при запросе.
   */
  extraParams?: Record<string, unknown>
  /** Включить запрос (по умолчанию true при непустом typeCode). */
  enabled?: boolean
}

interface UseEavEntriesResult<T> {
  entries: T[]
  totalElements: number
  isLoading: boolean
  isSortingOrFiltering: boolean
  isError: boolean
  error: unknown
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
}

export const useEavEntries = <T>(
  config: EavDomainConfig,
  typeCode: string,
  options: UseEavEntriesOptions = {}
): UseEavEntriesResult<T> => {
  const {
    sortAttr,
    sortDir,
    filter = EMPTY_FILTER,
    extraParams,
    enabled = true,
  } = options

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
    queryKey: [
      config.queryKeyPrefix,
      'entries',
      typeCode,
      sortAttr,
      sortDir,
      filter,
      extraParams,
    ],
    queryFn: ({ pageParam, signal }) => {
      // Защита: если домен НЕ поддерживает `q`-поиск (например регистры),
      // выбрасываем `q` из extraParams, чтобы бэк не вернул 400.
      const safeExtra =
        config.supportsQSearch || !extraParams
          ? extraParams
          : Object.fromEntries(
              Object.entries(extraParams).filter(([k]) => k !== 'q')
            )
      return searchEavEntries<T>(
        config,
        typeCode,
        filter,
        {
          page: pageParam,
          size: PAGE_SIZE,
          sortAttr,
          sortDir,
          ...safeExtra,
        },
        signal
      )
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const paged = lastPage.data.data
      return paged.last ? undefined : paged.number + 1
    },
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
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage: () => {
      void fetchNextPage()
    },
  }
}
