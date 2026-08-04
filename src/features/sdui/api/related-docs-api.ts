import { apiService } from '@/shared/api/api'

import type { ViewResponse } from '../types/view'

export type RelatedDocsAction = 'post' | 'unpost' | 'toggle-deletion-mark'

// Session-less дерево связанных документов (бэк-спека §3.2): зеркало
// movements-api.ts. entryId — корень дерева, anchorId — владелец вкладки
// (не передан ⇒ бэк берёт равным entryId).
export const fetchRelatedDocsView = async (
  entryId: string,
  anchorId?: string
): Promise<ViewResponse> => {
  const res = await apiService.get<ViewResponse>({
    url: `/api/view/related-documents/${entryId}`,
    params: anchorId ? { anchorId } : undefined,
  })
  return res.data
}

// Действие над выделенным узлом (бэк-спека §3.3): ответ всегда 200,
// исход в notify-эффекте + перестроенное дерево того же корня.
export const postRelatedDocsAction = async (
  action: RelatedDocsAction,
  entryId: string,
  rootId: string,
  anchorId: string
): Promise<ViewResponse> => {
  const res = await apiService.post<ViewResponse>({
    url: `/api/view/related-documents/${entryId}/${action}`,
    params: { rootId, anchorId },
  })
  return res.data
}
