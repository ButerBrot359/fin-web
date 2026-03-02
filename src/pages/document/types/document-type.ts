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
