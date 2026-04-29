import { apiService } from '@/shared/api/api'
import {
  getUniversalTypeUrl,
  getUniversalPagedUrl,
} from '@/shared/lib/consts/data-types'
import type { ApiResponse, PagedResponse } from '@/shared/types/api.types'
import type { DocumentType } from '@/entities/document-type'
import type { InformationRegisterEntry } from '../types/information-register'

export const getInformationRegisterType = (domain: string, code: string) =>
  apiService.get<ApiResponse<DocumentType>>({
    url: getUniversalTypeUrl(domain, code),
  })

export const getInformationRegisterEntries = (
  domain: string,
  typeCode: string
) =>
  apiService.get<ApiResponse<PagedResponse<InformationRegisterEntry>>>({
    url: getUniversalPagedUrl(domain, typeCode),
  })
