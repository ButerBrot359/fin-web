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
}

export type DocumentEntriesResponseData = ApiResponse<
  PagedResponse<DocumentEntry>
>
