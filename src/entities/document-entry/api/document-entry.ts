import { apiService } from '@/shared/api/api'
import type {
  CreateDocumentEntryPayload,
  DocumentEntriesResponseData,
  DocumentEntryNewResponseData,
  DocumentEntryResponseData,
} from '../types/document-entry'

export const getDocumentEntries = (typeCode: string) =>
  apiService.get<DocumentEntriesResponseData>({
    url: `/api/document-entries/${typeCode}/paged`,
  })

export const getNewDocumentEntry = (
  typeCode: string,
  params?: Record<string, string>
) =>
  apiService.get<DocumentEntryNewResponseData>({
    url: `/api/document-entries/${typeCode}/new`,
    params,
  })

export const getDocumentEntry = (id: string) =>
  apiService.get<DocumentEntryResponseData>({
    url: `/api/document-entries/id/${id}`,
  })

export const createDocumentEntry = (
  typeCode: string,
  payload: CreateDocumentEntryPayload
) =>
  apiService.post<DocumentEntryResponseData>({
    url: `/api/document-entries/${typeCode}`,
    data: payload,
  })

export const updateDocumentEntry = (
  id: number,
  payload: CreateDocumentEntryPayload
) =>
  apiService.put<DocumentEntryResponseData>({
    url: `/api/document-entries/id/${String(id)}`,
    data: payload,
  })
