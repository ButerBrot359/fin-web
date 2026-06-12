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

/** Остаток счёта на дату — для строки «Сальдо на начало» карточки. */
export interface AccountBalanceRow {
  accountId?: number | null
  accountCode?: string | null
  accountType?: string | null
  balanceDt?: number | string | null
  balanceKt?: number | string | null
  balance?: number | string | null
}

/**
 * Начальное сальдо счёта на дату (atDate). Используется как остаток на начало
 * периода карточки счёта.
 */
export const fetchAccountCardOpeningBalance = (
  atDate: string,
  accountId: number | undefined,
  signal?: AbortSignal
) =>
  apiService.get<ApiListResponse<AccountBalanceRow>>({
    url: `/api/accounting-registers/${ACCOUNT_CARD_REGISTER_TYPE_CODE}/balances`,
    params: {
      atDate,
      ...(accountId != null ? { accountId } : {}),
    },
    signal,
  })
