import { apiService } from '@/shared/api/api'
import type { ApiListResponse } from '@/entities/account-plan'

import type {
  ReportDefinitionDto,
  ReportFilterDto,
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
 * Динамические поля отбора (вкладка «Отборы»): GET /api/reports/{code}/filter-fields?accountId=
 * Ответ обёрнут в ApiListResponse (поле `list`). Возвращает КБП-каталог (6 измерений) +
 * при заданном accountId — динамические поля субконто выбранного счёта.
 */
export const fetchFilterFields = (
  code: string,
  accountId?: number | null,
  signal?: AbortSignal
) =>
  apiService.get<ApiListResponse<ReportFilterDto>>({
    url: `/api/reports/${code}/filter-fields`,
    params: accountId != null ? { accountId } : {},
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

/**
 * Печать отчёта в PDF: POST /api/reports/{code}/print?language=Ru|Kz
 * Тело — тот же RunReportBody, что и у /run. Ответ — PDF (Blob).
 *
 * Используется для отчётов, которые в 1С являются печатной формой-бланком
 * (например «Инвентарная карточка ОС»): их /run отдаёт спец-DTO без таблицы,
 * а отображаемый результат — готовый PDF с сервера. Для отчётов без движка
 * печати бэк отвечает HTTP 501 — вызывающий код показывает фолбэк.
 */
export const printReport = (
  code: string,
  body: RunReportBody,
  language: 'Ru' | 'Kz',
  signal?: AbortSignal
) =>
  apiService.postFileBlob({
    url: `/api/reports/${code}/print`,
    data: body,
    params: { language },
    signal,
  })
