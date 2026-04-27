import { apiService } from '@/shared/api/api'
import type {
  CreateDocumentEntryPayload,
  DocumentEntriesResponseData,
  DocumentEntryNewResponseData,
  DocumentEntryResponseData,
  PrintCommand,
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

export const getPrintCommands = (typeCode: string) =>
  apiService.get<PrintCommand[]>({
    url: `/api/document-entries/${typeCode}/print-commands`,
  })

export const printDocumentEntry = (
  typeCode: string,
  id: number,
  form?: string
) =>
  apiService.getFileBlob({
    url: `/api/document-entries/${typeCode}/${String(id)}/print`,
    params: form ? { form } : undefined,
  })
