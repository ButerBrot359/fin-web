import { apiService } from '@/shared/api/api'

import type { ActionRequest, ViewEffect } from '../types/view'
import { SELECTED_ROW_ID } from './view-request-params'

interface ActionRequestResponse {
  effects?: ViewEffect[]
}

// SCRUM-288 §2.1: минимальный исполнитель. GET/POST по готовому адресу, ответ —
// ТОЛЬКО носитель effects[]; сессию/дерево/ревизию не трогает (панель session-less).
export function createActionRequestExecutor(
  playEffects: (effects: ViewEffect[]) => void
) {
  return async function executeActionRequest(
    request: ActionRequest,
    selectedRowId?: string | number
  ): Promise<void> {
    // SCRUM-362 B-7: method обязателен (GET|POST); неизвестное значение —
    // отказ исполнять вместо тихого GET. Рантайм-гард шире типа сознательно:
    // контракту не доверяем на границе провода.
    const method: string = request.method
    if (method !== 'GET' && method !== 'POST') {
      console.warn('[sdui] action request с неизвестным method', request)
      return
    }
    let url = request.url
    // Единственная допустимая модификация адреса — один selectedRowId (§2.1).
    if (selectedRowId != null) {
      url += `${url.includes('?') ? '&' : '?'}${SELECTED_ROW_ID}=${String(selectedRowId)}`
    }
    const res =
      request.method === 'POST'
        ? await apiService.post<ActionRequestResponse>({
            url,
            data: request.body ?? undefined,
          })
        : await apiService.get<ActionRequestResponse>({ url })
    playEffects(res.data.effects ?? [])
  }
}
