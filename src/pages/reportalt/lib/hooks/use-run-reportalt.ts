import { useMemo } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { runReportAlt } from '../../api/reportalt-api'
import type {
  ReportAltResultDto,
  RunReportAltBody,
} from '../../types/reportalt'

/** Размер страницы LEDGER-отчётов (F4 — пагинация журналов проводок). */
export const LEDGER_PAGE_SIZE = 200

/**
 * Формирование отчёта ReportAlt по применённым параметрам.
 *
 * Для LEDGER-отчётов (`paged=true`) работает как infinite-query: первая
 * страница грузится сразу, следующие — по `fetchNextPage()` (кнопка «Показать
 * ещё»); строки всех страниц склеиваются в один результат. Для TREE/FORM
 * пагинация не применяется — уходит единственный запрос без page/pageSize.
 *
 * Ошибка 422 (невалидные параметры / max-rows guard) прилетает в `error`
 * телом ответа (см. `api.ts`) — страница показывает тост.
 */
export const useRunReportAlt = (
  code: string | undefined,
  body: RunReportAltBody | null,
  enabled: boolean,
  paged: boolean
) => {
  const { i18n } = useTranslation()

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    isError,
    error,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: [
      'reportalt-run',
      code,
      i18n.language,
      paged,
      JSON.stringify(body),
    ],
    queryFn: ({ signal, pageParam }) =>
      runReportAlt(
        code!,
        paged
          ? { ...body!, page: pageParam, pageSize: LEDGER_PAGE_SIZE }
          : body!,
        signal
      ),
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      paged && last.hasMore ? (last.page ?? pages.length - 1) + 1 : undefined,
    enabled: enabled && !!code && body != null,
    refetchOnWindowFocus: false,
    retry: false,
    staleTime: 60 * 1000,
  })

  // Склейка страниц: базой служит первая (шапка/колонки/итог), строки —
  // конкатенация всех загруженных страниц.
  const result = useMemo<ReportAltResultDto | null>(() => {
    const pages = data?.pages
    if (!pages || pages.length === 0) return null
    if (pages.length === 1) return pages[0]
    return { ...pages[0], rows: pages.flatMap((p) => p.rows) }
  }, [data])

  return {
    result,
    isLoading: isLoading || (isFetching && !isFetchingNextPage),
    isError,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    refetch,
  }
}
