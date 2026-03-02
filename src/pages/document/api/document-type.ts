import { apiService } from '@/shared/api/api'

export const getDocumentType = (code: string) =>
  apiService.get({ url: `/api/document-types/${code}` })

export const documentTypeApi = { getDocumentType }
