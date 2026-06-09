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
 *     ?from={ISO}&to={ISO}&expandBySubkonto=true[&accountId={Long}]
 * Ответ — ApiListResponse с массивом строк-счетов в поле `list`; каждая
 * строка содержит `children[]` — разворот по субконто-1 (см. OsvReportEntry).
 *
 * `expandBySubkonto` всегда `true` — этот экран по умолчанию показывает
 * разворот по аналитике (субконто-1), как ОСВ в 1С.
 */
export const fetchOsvReport = (params: OsvReportParams, signal?: AbortSignal) =>
  apiService.get<ApiListResponse<OsvReportEntry>>({
    url: `/api/accounting-registers/${OSV_REGISTER_TYPE_CODE}/balances-and-turnovers`,
    params: {
      from: params.from,
      to: params.to,
      expandBySubkonto: true,
      ...(params.accountId != null ? { accountId: params.accountId } : {}),
    },
    signal,
  })
