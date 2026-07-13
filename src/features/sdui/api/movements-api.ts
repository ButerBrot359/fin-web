import { apiService } from '@/shared/api/api'

import type { ViewResponse } from '../types/view'

// Session-less движения документа (спека §2.1): тот же ViewResponseDto,
// что и POST /api/view, но formSessionId = null, всё в effects[0].
export const fetchMovementsView = async (
  entryId: string,
): Promise<ViewResponse> => {
  const res = await apiService.get<ViewResponse>({
    url: `/api/view/movements/${entryId}`,
  })
  return res.data
}
