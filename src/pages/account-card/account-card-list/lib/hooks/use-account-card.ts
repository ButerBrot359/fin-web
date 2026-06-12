import { useQuery } from '@tanstack/react-query'

import { fetchAccountCard } from '../../api/account-card-api'
import type { AccountCardParams } from '../../types/account-card'

/**
 * Движения по счёту (карточка счёта) за период. Запрос включается, когда
 * заданы обе границы периода.
 */
export const useAccountCard = (
  params: AccountCardParams | null,
  enabled: boolean
) => {
  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: [
      'account-card',
      params?.from,
      params?.to,
      params?.accountId ?? null,
    ],
    queryFn: ({ signal }) => fetchAccountCard(params!, signal),
    select: (res) => res.data.list,
    enabled: enabled && params != null && !!params.from && !!params.to,
    staleTime: 60 * 1000,
  })

  return {
    rows: data ?? [],
    isLoading: isLoading || isFetching,
    isError,
  }
}
