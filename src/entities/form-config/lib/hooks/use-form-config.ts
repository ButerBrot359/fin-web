import { useSuspenseQuery } from '@tanstack/react-query'

import { getFormConfig } from '../../api/form-config'

export const useFormConfig = (name: string) => {
  const { data } = useSuspenseQuery({
    queryKey: ['form-configs', name],
    queryFn: () => getFormConfig(name),
    staleTime: 5 * 60 * 1000,
    select: (response) => response.data,
  })

  return data
}
