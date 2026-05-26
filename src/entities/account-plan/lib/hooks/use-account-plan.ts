import { useQuery } from '@tanstack/react-query'

import {
  fetchAccountPlanById,
  fetchAccountPlanEntries,
} from '../../api/account-plan'

interface UseAccountPlanOptions {
  parent?: number | null
  enabled?: boolean
}

/** Список счетов (плоский с признаком isGroup; иерархия — через parentId). */
export const useAccountPlan = ({
  parent,
  enabled = true,
}: UseAccountPlanOptions = {}) => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['account-plan', 'list', parent ?? null],
    queryFn: ({ signal }) =>
      fetchAccountPlanEntries(
        { parent: parent ?? undefined, includeSubconto: true },
        signal
      ),
    select: (res) => res.data.data.content,
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

/** Карточка одного счёта. */
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
