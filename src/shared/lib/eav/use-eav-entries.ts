import { useCallback, useMemo } from 'react'
import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query'

import { searchEavEntries } from './api'
import type { EavDomainConfig } from './domain-config'
import type { FilterRequest } from './types'

const PAGE_SIZE = 25
/** Размер страницы при выгрузке всех строк (минимизируем число запросов). */
const EXPORT_PAGE_SIZE = 200
/** Предохранитель от бесконечного цикла, если бэк не выставит `last`. */
const EXPORT_MAX_PAGES = 1000
const EMPTY_FILTER: FilterRequest = { filters: [], logic: 'AND' }

/**
 * Регистры не поддерживают `q`-поиск — выбрасываем `q` из extraParams,
 * иначе бэк вернёт 400. (Та же защита, что в queryFn инфинит-запроса.)
 */
const buildSafeExtra = (
  config: EavDomainConfig,
  extraParams?: Record<string, unknown>
): Record<string, unknown> | undefined =>
  config.supportsQSearch || !extraParams
    ? extraParams
    : Object.fromEntries(
        Object.entries(extraParams).filter(([k]) => k !== 'q')
      )

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
  /**
   * Загружает ВСЕ строки (все страницы) с текущими сортировкой/фильтром —
   * для выгрузки в Excel. Не затрагивает состояние грида.
   */
  fetchAllEntries: () => Promise<T[]>
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
    queryFn: ({ pageParam, signal }) =>
      searchEavEntries<T>(
        config,
        typeCode,
        filter,
        {
          page: pageParam,
          size: PAGE_SIZE,
          sortAttr,
          sortDir,
          ...buildSafeExtra(config, extraParams),
        },
        signal
      ),
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
  // Бэк не всегда отдаёт `totalElements` (Spring Slice вместо Page). Если
  // его нет — на последней странице это число загруженных, иначе хотя бы
  // не меньше загруженного.
  const reportedTotal = data?.pages[0]?.data.data.totalElements
  const totalElements =
    typeof reportedTotal === 'number' ? reportedTotal : entries.length

  const fetchAllEntries = useCallback(async (): Promise<T[]> => {
    const all: T[] = []
    let page = 0
    for (;;) {
      const res = await searchEavEntries<T>(config, typeCode, filter, {
        page,
        size: EXPORT_PAGE_SIZE,
        sortAttr,
        sortDir,
        ...buildSafeExtra(config, extraParams),
      })
      const paged = res.data.data
      all.push(...paged.content)
      if (paged.last || page >= EXPORT_MAX_PAGES) break
      page = paged.number + 1
    }
    return all
  }, [config, typeCode, filter, sortAttr, sortDir, extraParams])

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
