import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { AxiosResponse } from 'axios'

import type { EnumsValue } from '@/entities/document-type'

import { getEnumValues } from '../../api/enum-values-api'

/**
 * Значения перечисления для фильтра. Ключ кэша общий на код перечисления:
 * список значений меняется редко, поэтому пять минут живёт без перезапроса.
 */
export function useEnumValues(
  enumTypeCode: string | null | undefined,
  enabled: boolean
): UseQueryResult<EnumsValue[], unknown> {
  return useQuery<AxiosResponse<EnumsValue[]>, unknown, EnumsValue[]>({
    queryKey: ['filter-enum-values', enumTypeCode],
    queryFn: () => getEnumValues(enumTypeCode!),
    enabled: !!enumTypeCode && enabled,
    staleTime: 5 * 60 * 1000,
    select: (response) => response.data,
  })
}
