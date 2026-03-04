import { useQuery, useSuspenseQuery } from '@tanstack/react-query'

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

export const useOptionalFormConfig = (name: string) => {
  const { data, isLoading } = useQuery({
    queryKey: ['form-configs', name],
    queryFn: () => getFormConfig(name),
    staleTime: 5 * 60 * 1000,
    select: (response) => response.data,
    retry: false,
  })

  return { config: data ?? null, isLoading }
}
