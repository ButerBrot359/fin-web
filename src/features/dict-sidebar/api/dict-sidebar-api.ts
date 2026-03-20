import { apiService } from '@/shared/api/api'
import type { DataType } from '@/shared/lib/consts/data-types'
import {
  getTypeUrl,
  getPagedUrl,
  getSearchUrl,
} from '@/shared/lib/consts/data-types'
import type { DocumentType } from '@/entities/document-type'

interface PagedParams {
  page?: number
  size?: number
  sort?: string
  q?: string
  [key: string]: unknown
}

interface PagedResponse<T> {
  list: T[]
  totalSize: number
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
  dataType: DataType,
  typeCode: string,
  signal?: AbortSignal
) => {
  const url = getTypeUrl(dataType, typeCode)
  if (!url) throw new Error(`No type URL for ${dataType}`)
  return apiService.get<DocumentType>({ url, signal })
}

export const fetchDictEntriesPaged = (
  dataType: DataType,
  typeCode: string,
  params: PagedParams,
  signal?: AbortSignal
) => {
  const url = getPagedUrl(dataType, typeCode)
  if (!url) throw new Error(`No paged URL for ${dataType}`)
  return apiService.get<PagedResponse<DictEntry>>({ url, params, signal })
}

export const searchDictEntries = (
  dataType: DataType,
  typeCode: string,
  query: string,
  signal?: AbortSignal
) => {
  const url = getSearchUrl(dataType, typeCode)
  if (!url) throw new Error(`No search URL for ${dataType}`)
  return apiService.get<{ list: DictEntry[] }>({
    url,
    params: { q: query, size: 50 },
    signal,
  })
}

export interface DictEntryCreatePayload {
  code?: string
  nameRu: string
  nameKz?: string
  parentId?: number | null
  sortOrder?: number
  attributes: Record<string, unknown>
}

const ENTRY_BY_ID_PATHS: Partial<Record<DataType, string>> = {
  DICTIONARY: '/api/dictionaries/entries',
}

const ENTRY_CREATE_PATHS: Partial<Record<DataType, string>> = {
  DICTIONARY: '/api/dictionaries/entries',
}

export const fetchDictEntryById = (
  dataType: DataType,
  id: number | string,
  signal?: AbortSignal
) => {
  const basePath = ENTRY_BY_ID_PATHS[dataType]
  if (!basePath) throw new Error(`No entry URL for ${dataType}`)
  return apiService.get<DictEntry>({
    url: `${basePath}/id/${String(id)}`,
    signal,
  })
}

export const createDictEntry = (
  dataType: DataType,
  typeCode: string,
  payload: DictEntryCreatePayload
) => {
  const basePath = ENTRY_CREATE_PATHS[dataType]
  if (!basePath) throw new Error(`No create URL for ${dataType}`)
  return apiService.post<DictEntry>({
    url: `${basePath}/${typeCode}`,
    data: payload,
  })
}

export const updateDictEntry = (
  dataType: DataType,
  id: number | string,
  payload: DictEntryCreatePayload
) => {
  const basePath = ENTRY_BY_ID_PATHS[dataType]
  if (!basePath) throw new Error(`No update URL for ${dataType}`)
  return apiService.put<DictEntry>({
    url: `${basePath}/${String(id)}`,
    data: payload,
  })
}
