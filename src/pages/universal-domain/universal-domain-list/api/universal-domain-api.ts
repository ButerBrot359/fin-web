import { apiService } from '@/shared/api/api'
import {
  getUniversalTypeUrl,
  getUniversalPagedUrl,
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
  sort?: string
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
 * Пагинируемый список записей через универсальный домен:
 * `GET /api/universaldomain-entries/{domain}/{typeCode}/paged`.
 */
export const fetchUniversalDomainEntriesPaged = (
  domain: string,
  typeCode: string,
  params: UniversalPagedParams,
  signal?: AbortSignal
) =>
  apiService.get<UniversalPagedResponse>({
    url: getUniversalPagedUrl(domain, typeCode),
    params,
    signal,
  })
