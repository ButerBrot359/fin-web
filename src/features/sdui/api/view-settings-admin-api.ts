import { apiService } from '@/shared/api/api'
import type { ApiResponse } from '@/shared/types/api.types'

/**
 * Админка конструктора дизайна: реестр форм (layout'ов) со сводкой настроенных
 * слоёв и признак админства для входа. Реестр отдаётся только административным
 * ролям — не-админ получает 403, страница показывает заглушку.
 */

export interface ViewSettingsScreen {
  code: string
  nameRu: string | null
  nameKz: string | null
  targetDomain: string | null
  targetTypeCode: string | null
  hasDefault: boolean
  profileKeys: string[]
}

const baseUrl = '/api/view-settings-admin'

const unwrap = <T>(res: { data: ApiResponse<T> }): T => res.data.data

export const viewSettingsAdminApi = {
  me: (signal?: AbortSignal): Promise<{ admin: boolean }> =>
    apiService
      .get<ApiResponse<{ admin: boolean }>>({ url: `${baseUrl}/me`, signal })
      .then(unwrap),

  screens: (signal?: AbortSignal): Promise<ViewSettingsScreen[]> =>
    apiService
      .get<ApiResponse<ViewSettingsScreen[]>>({
        url: `${baseUrl}/screens`,
        signal,
      })
      .then(unwrap),
}
