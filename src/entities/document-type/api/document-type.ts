import { apiService } from '@/shared/api/api'
import type {
  DocumentTypeResponseData,
  OnGetFormResponseData,
} from '../types/document-type'

export const getDocumentType = (code: string) =>
  apiService.get<DocumentTypeResponseData>({
    url: `/api/document-types/${code}`,
  })

export const getOnGetForm = (code: string) =>
  apiService.get<OnGetFormResponseData>({
    url: `/api/document-types/${code}/on-get-form`,
  })
