import { useEffect, useMemo, useRef } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'

import { fetchListPage } from '../../api/reference-options'
import type {
  ListRow,
  ListSource,
} from '../../ui/nodes/composite/list-column-defs'

interface UseListInfiniteRowsArgs {
  source: ListSource | undefined
  /** Параметры уровня иерархии (или source.params как есть — решает вызывающий). */
  params: Record<string, string> | undefined
  /** ОТЛОЖЕННАЯ строка поиска: сидит в queryKey, смена перезапускает выборку. */
  search: string
  pageSize: number
}

/**
 * Бесконечная прокрутка LIST-узла: страницы через useInfiniteQuery + сентинел
 * IntersectionObserver, который вызывающий рендерит в конце списка.
 */
export const useListInfiniteRows = ({
  source,
  params,
  search,
  pageSize,
}: UseListInfiniteRowsArgs) => {
  const sentinelRef = useRef<HTMLDivElement>(null)

  const {
    data: pagedData,
    isLoading,
    isError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: [
      'sdui-list',
      source?.url,
      params,
      source?.method,
      source?.body,
      search,
      pageSize,
    ],
    queryFn: async ({ pageParam, signal }) => {
      if (!source) throw new Error('LIST node: source is required')
      return fetchListPage({
        url: source.url,
        params,
        method: source.method,
        body: source.body,
        page: pageParam,
        size: pageSize,
        search,
        signal,
      })
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const paged = lastPage.data
      return paged.last ? undefined : paged.number + 1
    },
    enabled: !!source,
    staleTime: 60 * 1000,
  })

  const rows: ListRow[] = useMemo(
    () => pagedData?.pages.flatMap((page) => page.data.content) ?? [],
    [pagedData]
  )

  // Infinite scroll via IntersectionObserver
  const loadMoreRef = useRef({ hasNextPage, isFetchingNextPage, fetchNextPage })
  // Пишем в эффекте, а не в теле рендера (react-hooks/refs): читатель —
  // колбэк IntersectionObserver, он срабатывает заведомо после коммита.
  useEffect(() => {
    loadMoreRef.current = { hasNextPage, isFetchingNextPage, fetchNextPage }
  })

  useEffect(() => {
    if (isLoading) return

    const sentinel = sentinelRef.current
    if (!sentinel) return

    // root НЕ задаём. Раньше корнем был контейнер прокрутки списка, но прокручивается
    // он не всегда: в drawer-панели высота не ограничена (PAGE не тянется по высоте),
    // скроллится внешний контейнер, а сентинел внутри контейнера остаётся в его
    // области всегда — наблюдатель срабатывал один раз при observe() и больше
    // никогда, из-за чего подгрузка вставала на второй странице («Загружено 50 из
    // 110»). Пересечение с вьюпортом считается с учётом отсечения всеми
    // прокручиваемыми предками, поэтому работает в обоих случаях.
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return
      const { hasNextPage, isFetchingNextPage, fetchNextPage } =
        loadMoreRef.current
      if (hasNextPage && !isFetchingNextPage) {
        void fetchNextPage()
      }
    })

    observer.observe(sentinel)
    return () => {
      observer.disconnect()
    }
    // rows.length в зависимостях — пересоздаём наблюдателя после каждой подгруженной
    // страницы: если сентинел так и остался в зоне видимости, событие пересечения
    // повторно не придёт и цепочка подгрузки оборвётся.
  }, [isLoading, rows.length])

  return {
    rows,
    pagedData,
    isLoading,
    isError,
    isFetchingNextPage,
    sentinelRef,
  }
}
