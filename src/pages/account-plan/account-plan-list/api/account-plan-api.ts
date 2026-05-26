import { apiService } from '@/shared/api/api'
import { getUniversalTypeUrl } from '@/shared/lib/consts/data-types'
import type { ApiResponse } from '@/shared/types/api.types'
import type { DocumentType } from '@/entities/document-type'

export const getAccountPlanType = (domain: string, code: string) =>
  apiService.get<ApiResponse<DocumentType>>({
    url: getUniversalTypeUrl(domain, code),
  })
