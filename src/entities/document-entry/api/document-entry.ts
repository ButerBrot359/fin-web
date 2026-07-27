import { apiService, LONG_OPERATION_TIMEOUT_MS } from '@/shared/api/api'
import type {
  CreateDocumentEntryPayload,
  DocumentEntriesResponseData,
  DocumentEntryNewResponseData,
  DocumentEntryResponseData,
  PrintCommand,
} from '../types/document-entry'

export const getDocumentEntries = (
  typeCode: string,
  params: { page: number; size: number; sortAttr?: string; sortDir?: string }
) =>
  apiService.get<DocumentEntriesResponseData>({
    url: `/api/document-entries/${typeCode}/paged`,
    params,
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

// Запись/проведение — самая долгая операция контура: бэкенд в одной транзакции
// пересоздаёт все строки ТЧ и пишет проводки (документы на ~1200 строк идут
// минутами). Обычный таймаут оборвал бы запрос, пока сервер ещё считает.
export const createDocumentEntry = (
  typeCode: string,
  payload: CreateDocumentEntryPayload
) =>
  apiService.post<DocumentEntryResponseData>({
    url: `/api/document-entries/${typeCode}`,
    data: payload,
    timeout: LONG_OPERATION_TIMEOUT_MS,
  })

export const updateDocumentEntry = (
  id: number,
  payload: CreateDocumentEntryPayload
) =>
  apiService.put<DocumentEntryResponseData>({
    url: `/api/document-entries/id/${String(id)}`,
    data: payload,
    timeout: LONG_OPERATION_TIMEOUT_MS,
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

export const unpostDocumentEntry = (id: number) =>
  apiService.post<DocumentEntryResponseData>({
    url: `/api/document-entries/${String(id)}/unpost`,
  })
