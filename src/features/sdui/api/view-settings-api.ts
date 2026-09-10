import { apiService } from '@/shared/api/api'
import type { ApiResponse } from '@/shared/types/api.types'

/**
 * Пер-пользовательские настройки вида экрана (конструктор дизайна Ф4,
 * спека 2026-09-10 §1.1). PUT — ПОЛНАЯ ЗАМЕНА патча: undo = PUT прежнего
 * массива. `screenKey` — непрозрачный ключ из ответа OPEN (`tree-store`).
 *
 * `visible`/`enabled` в патче могут быть только `false` (сервер отвергает
 * `true`): патч ограничивает представление, но не раскрывает скрытое по
 * правам; «показать обратно» = убрать запись из патча.
 */

export interface ViewSettingsPatchEntry {
  nodeId: string
  props: Record<string, unknown>
}

interface ViewSettingsResponse {
  patch: ViewSettingsPatchEntry[]
}

const url = (screenKey: string): string =>
  `/api/view-settings/${encodeURIComponent(screenKey)}`

const unwrap = <T>(res: { data: ApiResponse<T> }): T => res.data.data

export const viewSettingsApi = {
  get: (
    screenKey: string,
    signal?: AbortSignal
  ): Promise<ViewSettingsPatchEntry[]> =>
    apiService
      .get<ApiResponse<ViewSettingsResponse>>({ url: url(screenKey), signal })
      .then(unwrap)
      .then((data) => data.patch),

  put: (
    screenKey: string,
    patch: ViewSettingsPatchEntry[]
  ): Promise<ViewSettingsPatchEntry[]> =>
    apiService
      .put<ApiResponse<ViewSettingsResponse>>({
        url: url(screenKey),
        data: { patch },
      })
      .then(unwrap)
      .then((data) => data.patch),

  reset: async (screenKey: string): Promise<void> => {
    await apiService.delete({ url: url(screenKey) })
  },
}
