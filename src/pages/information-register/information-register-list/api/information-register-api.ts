import { apiService } from '@/shared/api/api'
import type { ApiResponse, PagedResponse } from '@/shared/types/api.types'
import type { DocumentType } from '@/entities/document-type'
import type { InformationRegisterEntry } from '../types/information-register'

export const getInformationRegisterType = (code: string) =>
  apiService.get<ApiResponse<DocumentType>>({
    url: `/api/information-register-types/${code}`,
  })

export const getInformationRegisterEntries = (typeCode: string) =>
  apiService.get<ApiResponse<PagedResponse<InformationRegisterEntry>>>({
    url: `/api/information-register-entries/${typeCode}/paged`,
  })
