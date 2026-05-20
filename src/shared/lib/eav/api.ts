import { apiService } from '@/shared/api/api'
import { serializeFilterForApi } from '@/shared/lib/filter/serialize-for-api'

import type { EavDomainConfig } from './domain-config'
import type {
  EavColumnsResponseData,
  EavSearchResponseData,
  FilterRequest,
} from './types'

export type EavSearchPageable = {
  page: number
  size: number
  sortAttr?: string
  sortDir?: string
}

export const searchEavEntries = <T>(
  config: EavDomainConfig,
  typeCode: string,
  filter: FilterRequest,
  params: EavSearchPageable,
  signal?: AbortSignal
) =>
  apiService.post<EavSearchResponseData<T>>({
    url: `${config.baseUrl}/${typeCode}/search`,
    data: serializeFilterForApi(filter),
    params,
    signal,
  })

export const getEavColumns = (
  config: EavDomainConfig,
  typeCode: string,
  signal?: AbortSignal
) =>
  apiService.get<EavColumnsResponseData>({
    url: `${config.baseUrl}/${typeCode}/columns`,
    signal,
  })
