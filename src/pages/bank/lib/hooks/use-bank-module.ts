import { useQuery } from '@tanstack/react-query'

import { settingsApi } from '@/shared/api/settings'

import type { ModuleItems } from '../../types/bank-module'

interface ModuleResponseData {
  data: {
    items: ModuleItems
  }
  success: boolean
}

export const useBankModule = () => {
  return useQuery({
    queryKey: ['settings', 'modules', 'BankiIKassy'],
    queryFn: () => settingsApi.getModule('BankiIKassy'),
    select: (response) => (response.data as ModuleResponseData).data.items,
  })
}
