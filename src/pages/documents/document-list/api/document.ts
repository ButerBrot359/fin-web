import { apiService } from '@/shared/api/api'

export const getDocumentEntries = (typeCode: string) =>
  apiService.get({ url: `/api/document-entries/${typeCode}/paged` })
