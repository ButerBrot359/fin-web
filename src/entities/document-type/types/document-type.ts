import type { ApiResponse } from '@/shared/types/api.types'
import type { DataType } from '@/shared/lib/consts/data-types'

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

export interface AllowedType {
  domainKind: string
  typeCode: string
  typeCode1C: string
  typeNameRu: string
  typeNameKz: string
}

export interface DocumentAttribute {
  id: number
  code: string
  code1C: string
  nameRu: string
  nameKz: string
  dataType: DataType
  domainKind: string | null
  isRequired: boolean
  readonly: boolean
  maxLength: number | null
  referenceTypeCode: string | null
  allowedTypes?: AllowedType[]
  referenceSelectionMode: string
  sortOrder: number
  tableSortOrder: number
  showInList: boolean
  showInForm: boolean
  defaultValue: string | null
  formEvent: string | null
}
