import { apiService } from '@/shared/api/api'
import type { ApiListResponse } from '@/entities/account-plan'

import {
  ANALYTICS_FILTER_KEYS,
  type AccountCardEntry,
  type AccountCardParams,
} from '../types/account-card'

/** Код типа регистра бухгалтерии, по которому строится карточка счёта. */
export const ACCOUNT_CARD_REGISTER_TYPE_CODE = 'ZhurnalProvodokGosUchrezhdeniya'

/** Размер страницы движений (lazy-load при >PAGE_SIZE проводок). */
export const ACCOUNT_CARD_PAGE_SIZE = 1000

/**
 * Ответ эндпоинта `/movements` (бэкендовый MovementsReportResponse): страница
 * движений `list` + агрегаты за весь период с учётом фильтров (для итогов и
 * пагинации, не зависят от страницы).
 */
export interface MovementsReportResponse
  extends ApiListResponse<AccountCardEntry> {
  totalCount?: number | null
  turnoverDt?: number | string | null
  turnoverKt?: number | string | null
  kolichestvoDt?: number | string | null
  kolichestvoKt?: number | string | null
  /** Сальдо на начало / конец периода (signed) — вычислено бэком. */
  openingBalance?: number | string | null
  closingBalance?: number | string | null
}

/** Только заданные (не-null) фильтры аналитики → query-параметры. */
const analyticsFilterParams = (
  params: AccountCardParams
): Record<string, number> => {
  const out: Record<string, number> = {}
  for (const key of ANALYTICS_FILTER_KEYS) {
    const v = params[key]
    if (v != null) out[key] = v
  }
  return out
}

/**
 * Карточка счёта: страница движений по счёту за период.
 * GET /api/accounting-registers/{typeCode}/movements
 *     ?from={ISO}&to={ISO}&pageSize&offset
 *     [&accountId][&fkrId&spetsifikaId&… — фильтры аналитики из ОСВ]
 */
export const fetchAccountCard = (
  params: AccountCardParams,
  offset: number,
  signal?: AbortSignal
) =>
  apiService.get<MovementsReportResponse>({
    url: `/api/accounting-registers/${ACCOUNT_CARD_REGISTER_TYPE_CODE}/movements`,
    params: {
      from: params.from,
      to: params.to,
      pageSize: ACCOUNT_CARD_PAGE_SIZE,
      offset,
      ...(params.accountId != null ? { accountId: params.accountId } : {}),
      ...analyticsFilterParams(params),
    },
    signal,
  })

/** Код справочника организаций (для фильтра «Организация»). */
export const ORGANIZATIONS_DICTIONARY_TYPE_CODE = 'Organizatsii'

/** Запись справочника организаций (активные). */
export interface OrganizationDto {
  id: number
  code?: string | null
  nameRu?: string | null
  nameKz?: string | null
  displayName?: string | null
}

/**
 * Активные организации — для выпадающего фильтра карточки счёта.
 * GET /api/dictionaries/entries/Organizatsii/active — отдаёт массив НАПРЯМУЮ
 * (без обёртки `{ data: { list } }`).
 */
export const fetchOrganizations = (signal?: AbortSignal) =>
  apiService.get<OrganizationDto[]>({
    url: `/api/dictionaries/entries/${ORGANIZATIONS_DICTIONARY_TYPE_CODE}/active`,
    signal,
  })
