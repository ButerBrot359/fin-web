import { apiService } from '@/shared/api/api'
import type { ApiListResponse } from '@/entities/account-plan'

import type { AccountCardEntry, AccountCardParams } from '../types/account-card'

/** Код типа регистра бухгалтерии, по которому строится карточка счёта. */
export const ACCOUNT_CARD_REGISTER_TYPE_CODE = 'ZhurnalProvodokGosUchrezhdeniya'

/**
 * Карточка счёта: движения по счёту за период.
 * GET /api/accounting-registers/{typeCode}/movements
 *     ?from={ISO}&to={ISO}[&accountId={Long}]
 */
export const fetchAccountCard = (
  params: AccountCardParams,
  signal?: AbortSignal
) =>
  apiService.get<ApiListResponse<AccountCardEntry>>({
    url: `/api/accounting-registers/${ACCOUNT_CARD_REGISTER_TYPE_CODE}/movements`,
    params: {
      from: params.from,
      to: params.to,
      ...(params.accountId != null ? { accountId: params.accountId } : {}),
    },
    signal,
  })
