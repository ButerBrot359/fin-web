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
