export interface AnalyticsDictionaryPermission {
  typeCode: string
  nameRu: string | null
  nameKz: string | null
  allowed: boolean
}
export interface AnalyticsDictionaryPermissionPage {
  items: AnalyticsDictionaryPermission[]
  page: number
  size: number
  totalElements: number
  allowedCount: number
  maxValuesPerDictionary: number
  maxValueLength: number
}
