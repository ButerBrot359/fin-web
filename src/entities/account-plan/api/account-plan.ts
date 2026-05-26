import { apiService } from '@/shared/api/api'
import type { ApiResponse } from '@/shared/types/api.types'

import type {
  AccountPlanCreatePayload,
  AccountPlanEntry,
  AccountPlanResponseData,
  SubcontoTypesResponseData,
} from '../types/account-plan'

interface AccountPlanListParams {
  /** Если задан — выбрать только дочерние группы/счета родителя. */
  parent?: number | null
  includeSubconto?: boolean
  lang?: string
}

export const fetchAccountPlanEntries = (
  params: AccountPlanListParams = {},
  signal?: AbortSignal
) =>
  apiService.get<ApiResponse<{ content: AccountPlanEntry[] }>>({
    url: '/api/account-plan',
    params: { includeSubconto: true, ...params },
    signal,
  })

export const fetchAccountPlanById = (
  id: number | string,
  signal?: AbortSignal
) =>
  apiService.get<AccountPlanResponseData>({
    url: `/api/account-plan/${String(id)}`,
    signal,
  })

export const createAccountPlanEntry = (payload: AccountPlanCreatePayload) =>
  apiService.post<AccountPlanResponseData>({
    url: '/api/account-plan',
    data: payload,
  })

export const updateAccountPlanEntry = (
  id: number | string,
  payload: AccountPlanCreatePayload
) =>
  apiService.put<AccountPlanResponseData>({
    url: `/api/account-plan/${String(id)}`,
    data: payload,
  })

export const fetchSubcontoTypes = (signal?: AbortSignal) =>
  apiService.get<SubcontoTypesResponseData>({
    url: '/api/characteristics-plan',
    params: { type: 'SUBCONTO' },
    signal,
  })
