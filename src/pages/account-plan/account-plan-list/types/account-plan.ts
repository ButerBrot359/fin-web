export interface AccountPlanEntry {
  id: number
  code?: string | null
  code1C?: string | null
  nameRu?: string | null
  nameKz?: string | null
  parentId?: number | null
  parentName?: string | null
  sortOrder?: number | null
  isActive?: boolean
  attributes: Record<string, unknown> | null
}
