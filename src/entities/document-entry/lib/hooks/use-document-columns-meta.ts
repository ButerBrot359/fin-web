import { useQuery } from '@tanstack/react-query'

import { getDocumentColumns } from '../../api/document-entry'
import type { ColumnMetaDto } from '../../types/filter'

interface UseDocumentColumnsMetaResult {
  columns: ColumnMetaDto[]
  isLoading: boolean
}

export const useDocumentColumnsMeta = (
  typeCode: string
): UseDocumentColumnsMetaResult => {
  const { data, isLoading } = useQuery({
    queryKey: ['document-columns', typeCode],
    queryFn: ({ signal }) => getDocumentColumns(typeCode, signal),
    enabled: !!typeCode,
    staleTime: Infinity,
    select: (response) => response.data.data,
  })

  return {
    columns: data ?? [],
    isLoading,
  }
}
