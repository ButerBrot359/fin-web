import { apiService } from '@/shared/api/api'
import type { ReportSpreadsheetDto } from '@/pages/reports/report-list/types/report'
import type { ApiResponse } from '@/shared/types/api.types'

import type {
  ReportAltDefinitionDto,
  ReportAltMetaDto,
  ReportAltParamStateBody,
  ReportAltParamStateDto,
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
 * Незаполненный бланк: GET /api/reportalt/{code}/blank.
 *
 * В 1С форма отчёта открывается пустым утверждённым бланком, и только «Заполнить» наполняет
 * его данными. Отчёты без бланка отвечают пустым телом — тогда форма ведёт себя как раньше.
 */
export const fetchReportAltBlank = (
  code: string,
  strok = 1,
  stranits = 1,
  signal?: AbortSignal
) =>
  apiService
    .get<
      ReportSpreadsheetDto | ApiResponse<ReportSpreadsheetDto | null> | null
    >({
      url: `/api/reportalt/${code}/blank`,
      params: { strok, stranits },
      signal,
    })
    .then((res) => unwrap(res.data) ?? null)

/**
 * «Выгрузить в XML 200.03»: приложение бланка отдельным файлом ФНО.
 *
 * <p>В 1С приложение по структурным подразделениям сдаётся своим файлом со своими кодом и
 * версией формы, поэтому это отдельная команда, а не часть общей выгрузки.
 *
 * @param ekzemplyar номер экземпляра многостраничного раздела; 1 — сам раздел
 */
export const vygruzkaPrilozheniya = (
  code: string,
  body: RunReportAltBody,
  ekzemplyar = 1,
  signal?: AbortSignal
) =>
  apiService.postFileBlob({
    url: `/api/reportalt/${code}/vygruzka-prilozheniya`,
    data: body,
    params: { ekzemplyar },
    signal,
  })

/** Что уходит в POST /api/reportalt/{code}/save — реквизиты сохраняемого экземпляра отчёта. */
export interface SaveReportAltBody {
  kodOtcheta: string
  naimenovanie: string
  organizatsiyaId?: number | null
  periodOt?: string | null
  periodDo?: string | null
  kommentariy?: string | null
  kazakhskiy: boolean
  znacheniyaBlanka: Record<string, string>
}

/**
 * Сохранение сформированного отчёта: POST /api/reportalt/{code}/save.
 *
 * Пишет документ «Регламентированный отчет» — из таких документов строится список сохранённой
 * отчётности, как в 1С.
 */
export const saveReportAlt = (
  code: string,
  body: SaveReportAltBody,
  signal?: AbortSignal
) =>
  apiService.post({
    url: `/api/reportalt/${code}/save`,
    data: body,
    signal,
  })

/**
 * Файл ФНО: GET /api/otchetnost/fno/{kodFormy}.
 *
 * Кнопка «Выгрузить в XML» формы 1С. Квартал бэк определяет по переданной дате — декларация
 * сдаётся за квартал целиком.
 */
/** Признаки шапки декларации, которые ставит пользователь: расчёт о них не знает. */
export interface VygruzkaFnoPriznaki {
  vidDeklaratsii?: string | null
  nomerUvedomleniya?: string | null
  dataUvedomleniya?: string | null
}

export const vygruzkaFno = (
  kodFormy: string,
  organizatsiyaId: number,
  period: string,
  priznaki: VygruzkaFnoPriznaki = {},
  signal?: AbortSignal
) =>
  apiService.getFileBlob({
    url: `/api/otchetnost/fno/${kodFormy}`,
    params: {
      organizatsiyaId,
      period,
      ...(priznaki.vidDeklaratsii
        ? { vidDeklaratsii: priznaki.vidDeklaratsii }
        : {}),
      ...(priznaki.nomerUvedomleniya
        ? { nomerUvedomleniya: priznaki.nomerUvedomleniya }
        : {}),
      ...(priznaki.dataUvedomleniya
        ? { dataUvedomleniya: priznaki.dataUvedomleniya }
        : {}),
    },
    signal,
  })

export const fetchReportAltParamState = (
  code: string,
  body: ReportAltParamStateBody,
  signal?: AbortSignal
) =>
  apiService
    .post<ReportAltParamStateDto | ApiResponse<ReportAltParamStateDto>>({
      url: `/api/reportalt/${code}/param-state`,
      data: body,
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
