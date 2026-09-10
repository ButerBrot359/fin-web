import { useQuery } from '@tanstack/react-query'

import { analyticsApi } from '../../api/analytics-api'
import type { AnalyticsOrganization } from '../../types/organization'
import { analyticsKeys } from '../query-keys'

/**
 * Организации для отбора.
 *
 * Кэш на десять минут: справочник организаций меняется редко, а список нужен на
 * каждом дашборде и отчёте — перезапрашивать его при каждом переходе незачем.
 */
export const useAnalyticsOrganizations = (): {
  organizations: AnalyticsOrganization[]
  isLoading: boolean
} => {
  const { data, isLoading } = useQuery({
    queryKey: analyticsKeys.organizations(),
    queryFn: ({ signal }) => analyticsApi.getOrganizations(signal),
    staleTime: 10 * 60_000,
  })
  return { organizations: data ?? [], isLoading }
}
