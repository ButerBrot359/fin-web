import { useQuery } from '@tanstack/react-query'

import { getAuditUsers, type AuditUserOption } from '../api/audit-log-api'

export const useAuditUsers = (): AuditUserOption[] => {
  const { data } = useQuery({
    queryKey: ['audit-log-users'],
    queryFn: ({ signal }) => getAuditUsers(signal),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
  return data ?? []
}
