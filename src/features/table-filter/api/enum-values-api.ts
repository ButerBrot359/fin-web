import type { AxiosResponse } from 'axios'

import { apiService } from '@/shared/api/api'
import type { EnumsValue } from '@/entities/document-type'

/** Значения перечисления для контрола фильтра. */
export const getEnumValues = (
  enumTypeCode: string
): Promise<AxiosResponse<EnumsValue[]>> =>
  apiService.get<EnumsValue[]>({
    url: `/api/enums/${enumTypeCode}/values`,
  })
