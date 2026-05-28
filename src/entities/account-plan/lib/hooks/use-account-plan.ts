import { useQuery } from '@tanstack/react-query'

import {
  DEFAULT_ACCOUNT_PLAN_TYPE_CODE,
  fetchAccountPlanById,
  fetchAccountPlanEntries,
  fetchAccountSubkontoKinds,
} from '../../api/account-plan'

interface UseAccountPlanListOptions {
  typeCode?: string
  parent?: number | null
  enabled?: boolean
}

/** Список счетов в рамках конкретного плана счетов (typeCode). */
export const useAccountPlanList = ({
  typeCode = DEFAULT_ACCOUNT_PLAN_TYPE_CODE,
  parent,
  enabled = true,
}: UseAccountPlanListOptions = {}) => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['account-plan', 'list', typeCode, parent ?? null],
    queryFn: ({ signal }) =>
      fetchAccountPlanEntries(typeCode, { parent: parent ?? undefined }, signal),
    select: (res) => res.data.list,
    staleTime: 5 * 60 * 1000,
    enabled,
  })

  return {
    entries: data ?? [],
    isLoading,
    isError,
    error,
  }
}

/** Карточка одного счёта — разворачиваем .data (одиночный ресурс). */
export const useAccountPlanItem = (id: number | string | null | undefined) => {
  const { data, isLoading } = useQuery({
    queryKey: ['account-plan', 'item', id],
    queryFn: ({ signal }) => fetchAccountPlanById(id!, signal),
    select: (res) => res.data.data,
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })

  return { account: data ?? null, isLoading }
}

/** Виды субконто для счёта — разворачиваем .list. */
export const useAccountSubkontoKinds = (
  accountId: number | string | null | undefined
) => {
  const { data, isLoading } = useQuery({
    queryKey: ['account-plan', 'subkonto-kinds', accountId],
    queryFn: ({ signal }) => fetchAccountSubkontoKinds(accountId!, signal),
    select: (res) => res.data.list,
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000,
  })

  return { kinds: data ?? [], isLoading }
}
