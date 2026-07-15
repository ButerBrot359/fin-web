import { apiService } from '@/shared/api/api'
import type { ApiResponse } from '@/shared/types/api.types'

interface MovementColumnMeta {
  code: string
  nameRu: string
  nameKz: string
  dataType: string
  objectKind: string
  sortOrder: number
}

interface MovementGroup {
  registerKind: string
  registerTypeCode: string
  registerTypeNameRu: string
  registerTypeNameKz: string
  columns: MovementColumnMeta[]
  entries: Record<string, unknown>[]
}

interface MovementsData {
  groups: MovementGroup[]
}

export type { MovementGroup, MovementColumnMeta }

export const fetchDocumentMovements = (entryId: string, signal?: AbortSignal) =>
  apiService.get<ApiResponse<MovementsData>>({
    url: `/api/document-entries/id/${entryId}/movements`,
    signal,
  })
