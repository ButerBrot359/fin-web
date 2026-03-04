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

export interface PagedResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
  first: boolean
  last: boolean
  empty: boolean
}

export interface DocumentEntriesResponseData {
  data: PagedResponse<DocumentEntry>
  success: boolean
}
