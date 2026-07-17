import { apiService } from '@/shared/api/api'
import type { ApiResponse } from '@/shared/types/api.types'

import type {
  ReportAltDefinitionDto,
  ReportAltMetaDto,
  ReportAltResultDto,
  RunReportAltBody,
} from '../types/reportalt'

/**
 * По ADR (webbuh docs/project/reportalt/architecture.md §11) ответы reportalt
 * обёрнуты в `ApiDataResponse<>` (поле `data`). Бэкенд пишется параллельно,
 * поэтому разворачиваем толерантно: и обёртку `{data, success}`, и «голый» DTO.
 */
const unwrap = <T>(payload: T | ApiResponse<T>): T => {
  if (
    payload != null &&
    typeof payload === 'object' &&
    'data' in payload &&
    'success' in payload
  ) {
    return payload.data
  }
  return payload
}

/** Список отчётов контура: GET /api/reportalt/reports (для навигации). */
export const fetchReportAltList = (signal?: AbortSignal) =>
  apiService
    .get<ReportAltDefinitionDto[] | ApiResponse<ReportAltDefinitionDto[]>>({
      url: '/api/reportalt/reports',
      signal,
    })
    .then((res) => unwrap(res.data))

/** Метаданные отчёта: GET /api/reportalt/{code}/meta. */
export const fetchReportAltMeta = (code: string, signal?: AbortSignal) =>
  apiService
    .get<ReportAltMetaDto | ApiResponse<ReportAltMetaDto>>({
      url: `/api/reportalt/${code}/meta`,
      signal,
    })
    .then((res) => unwrap(res.data))

/**
 * Формирование отчёта: POST /api/reportalt/{code}/run.
 * Тело — параметры + отборы (+ page/pageSize для LEDGER, F4).
 * При невалидных параметрах / превышении max-rows guard бэк отвечает 422 —
 * `api.ts` бросает тело ответа (ловится страницей, показывается тостом).
 */
export const runReportAlt = (
  code: string,
  body: RunReportAltBody,
  signal?: AbortSignal
) =>
  apiService
    .post<ReportAltResultDto | ApiResponse<ReportAltResultDto>>({
      url: `/api/reportalt/${code}/run`,
      data: body,
      signal,
    })
    .then((res) => unwrap(res.data))

/**
 * Печать отчёта в PDF: POST /api/reportalt/{code}/print?language=Ru|Kz.
 * Для отчётов без печатного бланка бэк отвечает 501 — вызывающий код
 * показывает тост «Печать недоступна».
 */
export const printReportAlt = (
  code: string,
  body: RunReportAltBody,
  language: 'Ru' | 'Kz',
  signal?: AbortSignal
) =>
  apiService.postFileBlob({
    url: `/api/reportalt/${code}/print`,
    data: body,
    params: { language },
    signal,
  })
