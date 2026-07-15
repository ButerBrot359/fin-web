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

export const fetchDocumentMovements = async (
  entryId: string,
  signal?: AbortSignal
) => {
  // Вариант БЕЗ сегмента `id/` отдаёт РАЗДЕЛЬНЫЕ Дт/Кт-поля измерений
  // (`podrazdelenieDt`/`podrazdelenieKt` и т.д.); `/id/{id}/movements`
  // возвращал их одним (коллапс-)полем на проводку → кредитная аналитика
  // показывала дебет. Если новый путь недоступен — откатываемся на прежний,
  // чтобы грид не сломался (в худшем случае аналитика как раньше).
  try {
    const res = await apiService.get<ApiResponse<MovementsData>>({
      url: `/api/document-entries/${entryId}/movements`,
      signal,
    })
    return res
  } catch {
    return apiService.get<ApiResponse<MovementsData>>({
      url: `/api/document-entries/id/${entryId}/movements`,
      signal,
    })
  }
}
