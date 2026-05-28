import { useQuery } from '@tanstack/react-query'

import {
  fetchSubcontoBuTypes,
  SUBCONTO_BU_TYPE_CODE,
} from '../../api/account-plan'

/** Список ВидыСубкoнтоБУ — для селекта в карточке счёта. */
export const useSubcontoBuTypes = (enabled = true) => {
  const { data, isLoading } = useQuery({
    queryKey: ['characteristics-plan', SUBCONTO_BU_TYPE_CODE],
    queryFn: ({ signal }) => fetchSubcontoBuTypes(signal),
    select: (res) => res.data.list,
    staleTime: 5 * 60 * 1000,
    enabled,
  })

  return { subcontoTypes: data ?? [], isLoading }
}
