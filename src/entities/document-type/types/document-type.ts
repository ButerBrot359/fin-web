import type { ApiResponse } from '@/shared/types/api.types'

export interface DocumentType {
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

export type DocumentTypeResponseData = ApiResponse<DocumentType>

export interface EnumsValue {
  id: number
  code: string
  code1C: string
  name: string
  enumCode: string
  isActive: boolean
}

export interface OnGetFormField {
  fieldName: string
  elements: EnumsValue[]
}

export type OnGetFormResponseData = ApiResponse<
  OnGetFormField | OnGetFormField[]
>

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
