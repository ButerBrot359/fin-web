import { useQuery } from '@tanstack/react-query'

import { getEavColumns } from './api'
import type { EavDomainConfig } from './domain-config'
import type { ColumnMetaDto } from './types'

interface UseEavColumnsMetaResult {
  columns: ColumnMetaDto[]
  isLoading: boolean
}

export const useEavColumnsMeta = (
  config: EavDomainConfig,
  typeCode: string
): UseEavColumnsMetaResult => {
  const { data, isLoading } = useQuery({
    queryKey: [config.queryKeyPrefix, 'columns', typeCode],
    queryFn: ({ signal }) => getEavColumns(config, typeCode, signal),
    enabled: !!typeCode,
    staleTime: Infinity,
    select: (response) => response.data.data,
  })

  return {
    columns: data ?? [],
    isLoading,
  }
}
