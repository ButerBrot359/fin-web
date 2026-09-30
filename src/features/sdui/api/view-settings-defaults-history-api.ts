import { apiService } from '@/shared/api/api'
import type { ApiResponse } from '@/shared/types/api.types'

/**
 * История изменений «формы для всех» (SCRUM-412 п.4): журнал сохранений и
 * сбросов админских дефолтов вида — общего слоя и пер-ролевых профилей.
 * Сервер отдаёт список только административным ролям.
 */

export interface ViewSettingsDefaultsHistoryEntry {
  /** ISO-строка момента действия. */
  savedAt: string
  /** Имя админа на момент записи; null — неизвестен. */
  savedByName: string | null
  /** Ключ профиля пер-ролевого слоя; null — общий «для всех». */
  profileKey: string | null
  action: 'SAVE' | 'RESET'
  /** Число нод в патче после действия (у RESET — 0). */
  entriesCount: number
}

export const viewSettingsDefaultsHistoryApi = {
  list: (
    screenKey: string,
    signal?: AbortSignal
  ): Promise<ViewSettingsDefaultsHistoryEntry[]> =>
    apiService
      .get<ApiResponse<ViewSettingsDefaultsHistoryEntry[]>>({
        url: `/api/view-settings-defaults/${encodeURIComponent(screenKey)}/history`,
        signal,
      })
      .then((res) => res.data.data),
}
