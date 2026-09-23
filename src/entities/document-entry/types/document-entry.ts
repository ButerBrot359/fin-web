import type { AsyncTask } from '@/entities/async-task'
import type { RecalculationNotice } from '@/entities/recalculation-notice'
import type { ApiResponse, PagedResponse } from '@/shared/types/api.types'

export interface DocumentEntry {
  id: number
  documentTypeCode: string
  documentTypeCode1C: string
  code: string
  nameRu: string
  nameKz: string
  parentId: number | null
  parentName: string | null
  sortOrder: number
  isActive: boolean
  isPosted: boolean
  attributes: Record<string, unknown>
  children: DocumentEntry[]
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  createdBy: string
  updatedBy: string
  // SCRUM-330 (ADR-0079): уведомления о пересчёте после синхронного
  // проведения/отмены документа-триггера. Сервер шлёт [] (не null), когда
  // устаревших расчётов нет; опционально — старые ответы поля не несут.
  recalculationNotices?: RecalculationNotice[]
}

export interface CreateDocumentEntryPayload {
  code: string
  nameRu: string
  nameKz: string
  parentId: number | null
  sortOrder: number
  isPosted: boolean
  attributes: Record<string, unknown>
}

export type DocumentEntriesResponseData = ApiResponse<
  PagedResponse<DocumentEntry>
>

export type DocumentEntryNewResponseData = ApiResponse<DocumentEntry>

export type DocumentEntryResponseData = ApiResponse<DocumentEntry>

/**
 * Ответ проведения (SCRUM-330, асинхронный тракт): поля идут плоско из
 * Java-record. HTTP 200 → `async:false` + `document` (проведено синхронно);
 * HTTP 202 → `async:true` + `task` (ушло в фон, следить вотчером задач).
 * Исходы различаем по полю `async`, не по HTTP-статусу.
 */
export interface PostingResult {
  async: boolean
  document?: DocumentEntry | null
  task?: AsyncTask | null
}

export interface PrintCommand {
  checkBeforePrint: boolean
  handler: string
  order: number
  name: string
  id: string
}
