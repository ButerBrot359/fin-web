import { useQuery } from '@tanstack/react-query'

import { fetchSubcontoTypes } from '../../api/account-plan'

/** Виды субконто из ПланВидовХарактеристик (SUBCONTO). Для селекта в карточке. */
export const useSubcontoTypes = (enabled = true) => {
  const { data, isLoading } = useQuery({
    queryKey: ['characteristics-plan', 'SUBCONTO'],
    queryFn: ({ signal }) => fetchSubcontoTypes(signal),
    select: (res) => res.data.data.content,
    staleTime: 5 * 60 * 1000,
    enabled,
  })

  return { subcontoTypes: data ?? [], isLoading }
}
