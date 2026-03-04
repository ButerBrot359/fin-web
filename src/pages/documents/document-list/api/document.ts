import { apiService } from '@/shared/api/api'

export const getDocumentType = (code: string) =>
  apiService.get({ url: `/api/document-types/${code}` })

export const getDocumentEntries = (typeCode: string) =>
  apiService.get({ url: `/api/document-entries/${typeCode}/paged` })

export const documentService = { getDocumentType, getDocumentEntries }
