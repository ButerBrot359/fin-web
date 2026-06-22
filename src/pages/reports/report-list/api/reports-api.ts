import { apiService } from '@/shared/api/api'
import type { ApiListResponse } from '@/entities/account-plan'

import type {
  ReportDefinitionDto,
  ReportMetaDto,
  ReportResultDto,
  ReportsListParams,
  RunReportBody,
} from '../types/report'

/**
 * Список отчётов: GET /api/reports?subsystem=&kind=&status=
 * Ответ обёрнут в ApiListResponse (поле `list`), как остальные коллекции.
 */
export const fetchReportsList = (
  params: ReportsListParams = {},
  signal?: AbortSignal
) =>
  apiService.get<ApiListResponse<ReportDefinitionDto>>({
    url: '/api/reports',
    params: {
      ...(params.subsystem ? { subsystem: params.subsystem } : {}),
      ...(params.kind ? { kind: params.kind } : {}),
      ...(params.status ? { status: params.status } : {}),
    },
    signal,
  })

/**
 * Метаданные отчёта: GET /api/reports/{code}/meta
 * Внимание: ответ — ReportMetaDto НАПРЯМУЮ, без обёртки `.data`/`.list`.
 */
export const fetchReportMeta = (code: string, signal?: AbortSignal) =>
  apiService.get<ReportMetaDto>({
    url: `/api/reports/${code}/meta`,
    signal,
  })

/**
 * Формирование отчёта: POST /api/reports/{code}/run
 * Тело — { variantCode?, parameters }. Ответ — ReportResultDto НАПРЯМУЮ.
 *
 * Для DRAFT-отчётов бэк отвечает HTTP 422 — axios в `api.ts` бросает
 * `error.response.data` (строку/объект сообщения). Ловится в хуке/странице:
 * показываем «Отчёт ещё не реализован».
 */
export const runReport = (
  code: string,
  body: RunReportBody,
  signal?: AbortSignal
) =>
  apiService.post<ReportResultDto>({
    url: `/api/reports/${code}/run`,
    data: body,
    signal,
  })
