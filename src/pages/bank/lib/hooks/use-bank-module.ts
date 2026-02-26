import { useQuery } from '@tanstack/react-query'

import { settingsApi } from '@/shared/api/settings'

export const useBankModule = () => {
  return useQuery({
    queryKey: ['settings', 'modules', 'BankiIKassy'],
    queryFn: () => settingsApi.getModule('BankiIKassy'),
    select: (response) => response.data,
  })
}
