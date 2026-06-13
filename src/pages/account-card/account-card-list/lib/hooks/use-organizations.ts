import { useQuery } from '@tanstack/react-query'

import { fetchOrganizations } from '../../api/account-card-api'

/**
 * Активные организации для фильтра «Организация» карточки счёта. Справочник
 * меняется редко — держим в кэше подольше.
 */
export const useOrganizations = () => {
  const { data } = useQuery({
    queryKey: ['organizations', 'active'],
    queryFn: ({ signal }) => fetchOrganizations(signal),
    select: (res) => res.data,
    staleTime: 5 * 60 * 1000,
  })

  return { organizations: data ?? [] }
}
