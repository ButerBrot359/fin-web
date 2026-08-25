import { useEffect, useRef, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'

import type { ViewNode } from '../../types/view'
import type { PaginationLoadTrigger } from '../../types/pagination'
import { fetchListPage } from '../../api/reference-options'
import { useSduiSession } from '../sdui-session-context'
import { readPagination } from '../utils/pagination'

/** Фолбэк на случай, если бэк не прислал pageSize (контракт его требует). */
const FALLBACK_PAGE_SIZE = 200

export interface PagedTableRows<TRow> {
  /** Нода в PAGED-режиме: строки едут страницами из source.url, не из state. */
  paged: boolean
  rows: TRow[]
  isLoading: boolean
  isError: boolean
  isFetchingNextPage: boolean
  hasNextPage: boolean
  loadTrigger: PaginationLoadTrigger
  fetchNextPage: () => void
  /** Колбэк-ref: вешать на сентинел внизу таблицы (только INFINITE_SCROLL). */
  attachSentinel: (node: HTMLElement | null) => void
}

/**
 * Строки таблицы по контракту SCRUM-368: INLINE (нет props.pagination) —
 * прежний путь `state[binding]`; PAGED — страницы с `source.url` (page/size,
 * Page-обёртка — тот же fetchListPage, что у LIST), догрузка сентинелом
 * (INFINITE_SCROLL, дефолт) или кнопкой (SHOW_MORE — рендерит потребитель).
 * PAGED-таблицы в OPEN приходят без данных (v2-back §4), поэтому state
 * в этом режиме не читается вовсе.
 */
export function usePagedTableRows<TRow>(node: ViewNode): PagedTableRows<TRow> {
  const { getValue } = useSduiSession()
  const pagination = readPagination(node)
  const paged = pagination?.mode === 'PAGED' && pagination.source != null
  const source = pagination?.source
  const pageSize = pagination?.pageSize ?? FALLBACK_PAGE_SIZE
  const loadTrigger = pagination?.loadTrigger ?? 'INFINITE_SCROLL'

  const {
    data,
    isLoading,
    isError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: [
      'sdui-table-page',
      source?.url,
      source?.params,
      source?.method,
      source?.body,
      pageSize,
    ],
    queryFn: async ({ pageParam, signal }) => {
      if (!source) throw new Error('paged table: source is required')
      return fetchListPage({
        url: source.url,
        params: source.params,
        method: source.method,
        body: source.body,
        page: pageParam,
        size: pageSize,
        signal,
      })
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const page = lastPage.data
      return page.last ? undefined : page.number + 1
    },
    enabled: paged,
    staleTime: 60 * 1000,
  })

  const pagedRows = data?.pages.flatMap((page) => page.data.content) ?? []
  const inlineRows = (getValue(node.binding) as TRow[] | undefined) ?? []
  const rows = paged ? (pagedRows as TRow[]) : inlineRows

  // Сентинел бесконечного скролла — паттерн list-node: root не задаём
  // (скроллит либо контейнер таблицы, либо внешний предок — пересечение с
  // вьюпортом учитывает отсечение всеми прокручиваемыми предками); свежие
  // колбэки читаем через ref, чтобы не пересоздавать наблюдателя на каждый ответ.
  const loadMoreRef = useRef({ hasNextPage, isFetchingNextPage, fetchNextPage })
  useEffect(() => {
    loadMoreRef.current = { hasNextPage, isFetchingNextPage, fetchNextPage }
  })
  const [sentinel, setSentinel] = useState<HTMLElement | null>(null)

  const observing = paged && loadTrigger === 'INFINITE_SCROLL' && !isLoading

  useEffect(() => {
    if (!observing || !sentinel) return

    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return
      const current = loadMoreRef.current
      if (current.hasNextPage && !current.isFetchingNextPage) {
        void current.fetchNextPage()
      }
    })
    observer.observe(sentinel)
    return () => {
      observer.disconnect()
    }
    // rows.length в зависимостях — как в list-node: если сентинел остался в зоне
    // видимости после подгрузки, повторного события пересечения не будет.
  }, [observing, sentinel, rows.length])

  return {
    paged,
    rows,
    isLoading: paged && isLoading,
    isError: paged && isError,
    isFetchingNextPage,
    hasNextPage: paged && hasNextPage,
    loadTrigger,
    fetchNextPage: () => {
      void fetchNextPage()
    },
    attachSentinel: setSentinel,
  }
}
