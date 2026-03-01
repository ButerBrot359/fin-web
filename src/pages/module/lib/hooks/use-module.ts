import { useSuspenseQuery } from '@tanstack/react-query'

import { settingsApi } from '@/shared/api/settings'

import type { ModuleItems } from '../../types/module'

interface ModuleResponseData {
  data: {
    items: ModuleItems
  }
  success: boolean
}

export const useModule = (pageCode: string) => {
  return useSuspenseQuery({
    queryKey: ['settings', 'modules', pageCode],
    queryFn: () => settingsApi.getModule(pageCode),
    select: (response) => (response.data as ModuleResponseData).data.items,
  })
}
