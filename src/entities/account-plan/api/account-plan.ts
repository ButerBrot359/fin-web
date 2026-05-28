import { apiService } from '@/shared/api/api'

import type {
  AccountPlanEntryDto,
  AccountPlanEntryPayload,
  AccountPlanSubkontoKindDto,
  ApiListResponse,
  ApiSingleResponse,
  SubcontoBuType,
} from '../types/account-plan'

/** typeCode плана счетов госучреждений; используется в URL по умолчанию. */
export const DEFAULT_ACCOUNT_PLAN_TYPE_CODE =
  'EdiniyPlanSchetovGosUchrezhdeniya'

/** typeCode плана видов характеристик «Виды субконто (БУ)». */
export const SUBCONTO_BU_TYPE_CODE = 'VidySubcontoBu'

interface ListParams {
  /** parentId — если задан, бэк отдаёт только потомков. */
  parent?: number | null
}

export const fetchAccountPlanEntries = (
  typeCode: string,
  params: ListParams = {},
  signal?: AbortSignal
) =>
  apiService.get<ApiListResponse<AccountPlanEntryDto>>({
    url: `/api/account-plan/${typeCode}/entries`,
    params: { parent: params.parent ?? undefined },
    signal,
  })

export const fetchAccountPlanById = (
  id: number | string,
  signal?: AbortSignal
) =>
  apiService.get<ApiSingleResponse<AccountPlanEntryDto>>({
    url: `/api/account-plan/entries/${String(id)}`,
    signal,
  })

export const fetchAccountSubkontoKinds = (
  id: number | string,
  signal?: AbortSignal
) =>
  apiService.get<ApiListResponse<AccountPlanSubkontoKindDto>>({
    url: `/api/account-plan/entries/${String(id)}/subkonto-kinds`,
    signal,
  })

export const createAccountPlanEntry = (
  typeCode: string,
  payload: AccountPlanEntryPayload
) =>
  apiService.post<ApiSingleResponse<AccountPlanEntryDto>>({
    url: `/api/account-plan/${typeCode}/entries`,
    data: payload,
  })

export const updateAccountPlanEntry = (
  id: number | string,
  payload: AccountPlanEntryPayload
) =>
  apiService.put<ApiSingleResponse<AccountPlanEntryDto>>({
    url: `/api/account-plan/entries/${String(id)}`,
    data: payload,
  })

export const deleteAccountPlanEntry = (id: number | string) =>
  apiService.delete<ApiSingleResponse<unknown>>({
    url: `/api/account-plan/entries/${String(id)}`,
  })

export const fetchSubcontoBuTypes = (signal?: AbortSignal) =>
  apiService.get<ApiListResponse<SubcontoBuType>>({
    url: `/api/characteristics-plan/${SUBCONTO_BU_TYPE_CODE}/entries`,
    signal,
  })
