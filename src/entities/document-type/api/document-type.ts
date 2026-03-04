import { apiService } from '@/shared/api/api'
import type { DocumentTypeResponseData } from '../types/document-type'

export const getDocumentType = (code: string) =>
  apiService.get<DocumentTypeResponseData>({
    url: `/api/document-types/${code}`,
  })
