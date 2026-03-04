export interface DocumentTypeResponseData {
  data: {
    id: number
    code: string
    code1C: string
    nameRu: string
    nameKz: string
    description: string
    isHierarchical: boolean
    isActive: boolean
    isTablePart: boolean
    attributes: DocumentAttribute[]
  }
  success: boolean
}

export interface DocumentAttribute {
  id: number
  code: string
  code1C: string
  nameRu: string
  nameKz: string
  dataType: string
  isRequired: boolean
  maxLength: number | null
  referenceTypeCode: string | null
  referenceSelectionMode: string
  sortOrder: number
  tableSortOrder: number
  showInList: boolean
  showInForm: boolean
  defaultValue: string | null
}

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
