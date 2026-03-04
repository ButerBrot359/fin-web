import { useSuspenseQuery } from '@tanstack/react-query'

import { getModule } from '../../api/module'

export const useModule = (pageCode: string) => {
  return useSuspenseQuery({
    queryKey: ['settings', 'modules', pageCode],
    queryFn: () => getModule(pageCode),
    staleTime: 5 * 60 * 1000,
    select: (response) => response.data.data.items,
  })
}
