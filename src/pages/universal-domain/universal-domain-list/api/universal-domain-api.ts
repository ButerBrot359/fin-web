import { apiService } from '@/shared/api/api'
import {
  getUniversalTypeUrl,
  getUniversalSearchUrl,
} from '@/shared/lib/consts/data-types'
import type { ApiResponse } from '@/shared/types/api.types'
import type { DocumentType } from '@/entities/document-type'

import type { UniversalDomainEntry } from '../types/universal-domain'

/** Метаданные типа объекта из универсального домена (`domain` + `typeCode`). */
export const getUniversalDomainType = (domain: string, code: string) =>
  apiService.get<ApiResponse<DocumentType>>({
    url: getUniversalTypeUrl(domain, code),
  })

export interface UniversalPagedParams {
  page?: number
  size?: number
  sortAttr?: string
  sortDir?: string
  [key: string]: unknown
}

export interface UniversalPagedResponse {
  data: {
    content: UniversalDomainEntry[]
    totalElements?: number
    number: number
    last: boolean
  }
  success: boolean
}

/**
 * Плоский пагинируемый список записей через универсальный домен:
 * `GET /api/universaldomain-entries/{domain}/{typeCode}/search?q=`.
 *
 * Используем именно `/search` (с пустым `q`), а не `/paged`: `/paged` для
 * иерархических типов отдаёт только корневой уровень, тогда как `/search`
 * перечисляет все записи (та же логика, что в `dict-sidebar`).
 */
export const fetchUniversalDomainEntries = (
  domain: string,
  typeCode: string,
  params: UniversalPagedParams,
  signal?: AbortSignal
) =>
  apiService.get<UniversalPagedResponse>({
    url: getUniversalSearchUrl(domain, typeCode),
    params: { q: '', ...params },
    signal,
  })
