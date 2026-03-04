import { apiService } from '@/shared/api/api'
import type { DocumentEntriesResponseData } from '../types/document-entry'

export const getDocumentEntries = (typeCode: string) =>
  apiService.get<DocumentEntriesResponseData>({
    url: `/api/document-entries/${typeCode}/paged`,
  })
