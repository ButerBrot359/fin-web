import { useQuery } from '@tanstack/react-query'

import { analyticsApi } from '../../api/analytics-api'
import type { AiStatisticsFilters } from '../../types/ai-statistics'
import { analyticsKeys } from '../query-keys'

/** No previous-filter placeholder: totals must always match the visible filters. */
export const useAiStatistics = (filters: AiStatisticsFilters) => {
  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: analyticsKeys.aiStatistics(filters),
    queryFn: ({ signal }) => analyticsApi.getAiStatistics(filters, signal),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: false,
  })

  return { data: data ?? null, isLoading, isFetching, isError, refetch }
}
