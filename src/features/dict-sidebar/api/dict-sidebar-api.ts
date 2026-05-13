import { apiService } from '@/shared/api/api'
import {
  getUniversalTypeUrl,
  getUniversalPagedUrl,
  getUniversalSearchUrl,
  getUniversalEntryByIdUrl,
  getUniversalEntriesUrl,
} from '@/shared/lib/consts/data-types'
import type { DocumentType } from '@/entities/document-type'
import type { ApiResponse } from '@/shared/types/api.types'

interface PagedParams {
  page?: number
  size?: number
  sort?: string
  q?: string
  [key: string]: unknown
}

interface PagedResponse<T> {
  data: {
    content: T[]
    totalElements: number
    totalPages: number
    number: number
    size: number
    last: boolean
  }
  success: boolean
}

export interface DictEntry {
  id: number
  code: string
  nameRu: string
  nameKz: string
  displayName?: string
  isActive: boolean
  attributes: Record<string, unknown> | null
}

export const fetchDictTypeMetadata = (
  domain: string,
  typeCode: string,
  signal?: AbortSignal
) =>
  apiService.get<ApiResponse<DocumentType>>({
    url: getUniversalTypeUrl(domain, typeCode),
    signal,
  })

export const fetchDictEntriesPaged = (
  domain: string,
  typeCode: string,
  params: PagedParams,
  signal?: AbortSignal
) =>
  apiService.get<PagedResponse<DictEntry>>({
    url: getUniversalPagedUrl(domain, typeCode),
    params,
    signal,
  })

export const searchDictEntries = (
  domain: string,
  typeCode: string,
  query: string,
  extraParams?: Record<string, string>,
  signal?: AbortSignal
) =>
  apiService.get<ApiResponse<{ content: DictEntry[] }>>({
    url: getUniversalSearchUrl(domain, typeCode),
    params: { q: query, size: 50, ...extraParams },
    signal,
  })

export interface DictEntryCreatePayload {
  code?: string
  nameRu: string
  nameKz?: string
  parentId?: number | null
  sortOrder?: number
  attributes: Record<string, unknown>
}

export const fetchDictEntryById = (
  domain: string,
  id: number | string,
  signal?: AbortSignal
) =>
  apiService.get<ApiResponse<DictEntry>>({
    url: getUniversalEntryByIdUrl(domain, id),
    signal,
  })

export const createDictEntry = (
  domain: string,
  typeCode: string,
  payload: DictEntryCreatePayload
) =>
  apiService.post<ApiResponse<DictEntry>>({
    url: getUniversalEntriesUrl(domain, typeCode),
    data: payload,
  })

export const updateDictEntry = (
  domain: string,
  id: number | string,
  payload: DictEntryCreatePayload
) =>
  apiService.put<ApiResponse<DictEntry>>({
    url: getUniversalEntryByIdUrl(domain, id),
    data: payload,
  })
