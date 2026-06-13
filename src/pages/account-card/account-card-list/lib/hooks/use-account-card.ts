import { useInfiniteQuery } from '@tanstack/react-query'

import {
  ACCOUNT_CARD_PAGE_SIZE,
  fetchAccountCard,
} from '../../api/account-card-api'
import { toNum } from '../utils/compute-card-lines'
import {
  ANALYTICS_FILTER_KEYS,
  type AccountCardParams,
  type AccountCardTotals,
} from '../../types/account-card'

/**
 * Движения по счёту (карточка счёта) за период с постраничной (lazy) загрузкой.
 * Страницы грузятся по порядку (period asc) — накопительное «текущее сальдо»
 * считается корректно по уже загруженным строкам. Итоги («Обороты за период»,
 * «Конечное сальдо») берутся из серверных агрегатов (по всем движениям, не
 * зависят от страницы). Запрос включается, когда заданы обе границы периода.
 */
export const useAccountCard = (
  params: AccountCardParams | null,
  enabled: boolean
) => {
  // Ключ кэша: период + счёт + все фильтры аналитики (drill-down из ОСВ).
  const filterKey = ANALYTICS_FILTER_KEYS.map((k) => params?.[k] ?? null)

  const query = useInfiniteQuery({
    queryKey: [
      'account-card',
      params?.from,
      params?.to,
      params?.accountId ?? null,
      ...filterKey,
    ],
    queryFn: ({ pageParam, signal }) =>
      fetchAccountCard(params!, pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce(
        (n, p) => n + (p.data.list?.length ?? 0),
        0
      )
      const total = lastPage.data.totalCount ?? loaded
      return loaded < total ? loaded : undefined
    },
    enabled: enabled && params != null && !!params.from && !!params.to,
    staleTime: 60 * 1000,
  })

  const rows = query.data?.pages.flatMap((p) => p.data.list ?? []) ?? []

  // Агрегаты берём из первой страницы (бэк отдаёт их одинаково на каждой).
  const head = query.data?.pages[0]?.data
  const totals: AccountCardTotals | null = head
    ? {
        totalCount: head.totalCount ?? rows.length,
        turnoverDt: toNum(head.turnoverDt),
        turnoverKt: toNum(head.turnoverKt),
        kolichestvoDt: toNum(head.kolichestvoDt),
        kolichestvoKt: toNum(head.kolichestvoKt),
        openingBalance: toNum(head.openingBalance),
        closingBalance: toNum(head.closingBalance),
      }
    : null

  return {
    rows,
    totals,
    /** Всего движений за период (для подписи «загружено X из Y»). */
    totalCount: totals?.totalCount ?? rows.length,
    pageSize: ACCOUNT_CARD_PAGE_SIZE,
    hasMore: query.hasNextPage,
    loadMore: query.fetchNextPage,
    isLoadingMore: query.isFetchingNextPage,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
