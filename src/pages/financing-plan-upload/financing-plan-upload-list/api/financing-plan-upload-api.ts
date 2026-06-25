import { apiService } from '@/shared/api/api'
import type { ApiResponse } from '@/shared/types/api.types'
import type { EnumsValue } from '@/entities/document-type'
import {
  DICTIONARY_DOMAIN_CONFIG,
  searchEavEntries,
  type FilterRequest,
} from '@/shared/lib/eav'

import {
  DVIZHENIE_DICTIONARY_TYPE_CODE,
  ISTOCHNIK_DICTIONARY_TYPE_CODE,
  VID_PLANA_ENUM_TYPE_CODE,
  type GenerateRequest,
  type GenerateResult,
  type ParseRequestParams,
  type ParseResult,
} from '../types/financing-plan-upload'

/** Код справочника организаций. */
export const ORGANIZATIONS_DICTIONARY_TYPE_CODE = 'Organizatsii'

/** Значения enum «Виды плана финансирования». Эндпоинт отдаёт массив напрямую (без обёртки `{ data }`). */
export const fetchVidyPlana = (signal?: AbortSignal) =>
  apiService.get<EnumsValue[]>({
    url: `/api/enums/${VID_PLANA_ENUM_TYPE_CODE}/values`,
    signal,
  })

/** Запись справочника из universal-search (поле `content`). */
export interface DictionarySearchEntry {
  id: number
  code?: string | null
  nameRu?: string | null
  nameKz?: string | null
  displayName?: string | null
}

/**
 * Записи справочника через универсальный поиск.
 * GET /api/universaldomain-entries/DICTIONARY/{typeCode}/search?q=&size=1000
 * → `{ data: { content: [...] } }`.
 */
const fetchDictionaryEntries = (typeCode: string, signal?: AbortSignal) =>
  apiService.get<ApiResponse<{ content: DictionarySearchEntry[] }>>({
    url: `/api/universaldomain-entries/DICTIONARY/${typeCode}/search`,
    params: { q: '', size: 1000 },
    signal,
  })

/** Виды источников финансирования (справочник). */
export const fetchIstochnikiFinansirovaniya = (signal?: AbortSignal) =>
  fetchDictionaryEntries(ISTOCHNIK_DICTIONARY_TYPE_CODE, signal)

/** Движения финансирования (справочник). */
export const fetchDvizheniyaFinansirovaniya = (signal?: AbortSignal) =>
  fetchDictionaryEntries(DVIZHENIE_DICTIONARY_TYPE_CODE, signal)

/** Сколько организаций тянуть за один серверный поиск. */
const ORGANIZATIONS_SEARCH_SIZE = 50

/**
 * Серверный поиск организаций по подстроке наименования (рус.) через Filter DSL —
 * как грид справочника: возвращает ТОЛЬКО совпадения (в отличие от устаревшего
 * `/active`, который отдавал весь справочник на клиентскую фильтрацию).
 * Пустой запрос → первая страница без фильтра.
 */
export const searchOrganizations = (query: string, signal?: AbortSignal) => {
  const q = query.trim()
  const filter: FilterRequest = q
    ? { filters: [{ field: 'nameRu', op: 'contains', value: q }], logic: 'AND' }
    : { filters: [], logic: 'AND' }
  return searchEavEntries<DictionarySearchEntry>(
    DICTIONARY_DOMAIN_CONFIG,
    ORGANIZATIONS_DICTIONARY_TYPE_CODE,
    filter,
    { page: 0, size: ORGANIZATIONS_SEARCH_SIZE },
    signal
  )
}

/**
 * Разбор Excel с планом финансирования.
 * POST /api/financing-plan-upload/parse — multipart/form-data.
 * sheetName / columnOffset отправляются только при заданных значениях.
 */
export const parseFinancingPlan = (
  file: File,
  params: ParseRequestParams,
  signal?: AbortSignal
) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('organizatsiyaId', String(params.organizatsiyaId))
  formData.append('vidPlana', params.vidPlana)
  formData.append('startRow', String(params.startRow))
  formData.append('vTysTenge', String(params.vTysTenge))
  formData.append('data', params.data)
  if (params.sheetName) {
    formData.append('sheetName', params.sheetName)
  }
  if (params.columnOffset != null) {
    formData.append('columnOffset', String(params.columnOffset))
  }

  return apiService.postFormData<ApiResponse<ParseResult>>({
    url: '/api/financing-plan-upload/parse',
    data: formData,
    signal,
  })
}

/**
 * Формирование и проведение документа плана финансирования.
 * POST /api/financing-plan-upload/generate — application/json.
 */
export const generateFinancingPlan = (
  body: GenerateRequest,
  signal?: AbortSignal
) =>
  apiService.post<ApiResponse<GenerateResult>>({
    url: '/api/financing-plan-upload/generate',
    data: body,
    signal,
  })
