import { apiService } from '@/shared/api/api'
import type { ApiListResponse } from '@/entities/account-plan'

import type { OsvReportEntry, OsvReportParams } from '../types/osv-report'

/**
 * Код типа регистра бухгалтерии, по которому строится ОСВ.
 * Эндпоинт ОСВ параметризован typeCode регистра (а не code пункта меню).
 */
export const OSV_REGISTER_TYPE_CODE = 'ZhurnalProvodokGosUchrezhdeniya'

/**
 * Оборотно-сальдовая ведомость: остатки и обороты по счетам за период.
 * GET /api/accounting-registers/{typeCode}/balances-and-turnovers
 *     ?from={ISO}&to={ISO}&groupByDimensions=true[&accountId={Long}]
 * Ответ — ApiListResponse с массивом строк-счетов в поле `list`; каждая
 * строка содержит рекурсивный `children[]` — многоуровневый разворот по
 * измерениям (ORGANIZATION → … → SUBKONTO), см. OsvReportEntry.
 *
 * `groupByDimensions` всегда `true` — этот экран показывает полную
 * иерархию по измерениям, как ОСВ в 1С. Параметр приоритетнее
 * `expandBySubkonto` на бэке.
 */
export const fetchOsvReport = (params: OsvReportParams, signal?: AbortSignal) =>
  apiService.get<ApiListResponse<OsvReportEntry>>({
    url: `/api/accounting-registers/${OSV_REGISTER_TYPE_CODE}/balances-and-turnovers`,
    params: {
      from: params.from,
      to: params.to,
      groupByDimensions: true,
      ...(params.accountId != null ? { accountId: params.accountId } : {}),
    },
    signal,
  })
