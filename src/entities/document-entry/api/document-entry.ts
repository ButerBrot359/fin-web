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
    // lightResponse=true — ответ без развёрнутых табличных частей. Из ответа читается только
    // id (см. use-document-entry-actions), а сервер иначе заново собирает и сериализует весь
    // документ: для 10 000 строк это десятки мегабайт на каждое сохранение и проведение.
    url: `/api/document-entries/${typeCode}?lightResponse=true`,
    data: payload,
    timeout: LONG_OPERATION_TIMEOUT_MS,
  })

export const updateDocumentEntry = (
  id: number,
  payload: CreateDocumentEntryPayload
) =>
  apiService.put<DocumentEntryResponseData>({
    // См. комментарий в createDocumentEntry — из ответа нужен только id.
    url: `/api/document-entries/id/${String(id)}?lightResponse=true`,
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

export const postDocumentEntry = (id: number) =>
  apiService.post<DocumentEntryResponseData>({
    url: `/api/document-entries/${String(id)}/post`,
    timeout: LONG_OPERATION_TIMEOUT_MS,
  })

export interface BulkEditPayload {
  selectedEntryIds: number[]
  commentEnabled: boolean
  comment: string
}

export interface BulkEditResult {
  selectedCount: number
  changedCount: number
}

// SCRUM-276 spec v2 §2.3: атомарная массовая смена комментария у выделенных
// непроведённых документов. Один невалидный id откатывает всю операцию.
// Ответ — в стандартной оболочке ApiDataResponse.data. Тип документа знает
// вызывающая сторона — entities-слой per-type кодов не хардкодит.
export const bulkEditDocumentEntries = (
  typeCode: string,
  payload: BulkEditPayload
) =>
  apiService.post<{ data: BulkEditResult }>({
    url: `/api/document-entries/${typeCode}/bulk-edit`,
    data: payload,
  })
