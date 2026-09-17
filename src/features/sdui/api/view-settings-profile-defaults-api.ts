import { apiService } from '@/shared/api/api'
import type { ApiResponse } from '@/shared/types/api.types'

import type { ViewSettingsPatchEntry } from './view-settings-api'

/**
 * Пер-ролевые дефолты вида: слой «для роли» между общим дефолтом Ф5 и личным
 * патчем. «Роль» — профиль групп доступа (то, что админ назначает в карточке
 * пользователя); список профилей для селектора отдаёт бэк. Формат патча и
 * семантика полной замены — те же, что у остальных слоёв.
 */

export interface ViewSettingsProfile {
  code: string
  name: string | null
}

interface ViewSettingsResponse {
  patch: ViewSettingsPatchEntry[]
}

const baseUrl = '/api/view-settings-profile-defaults'

const url = (screenKey: string): string =>
  `${baseUrl}/${encodeURIComponent(screenKey)}`

const unwrap = <T>(res: { data: ApiResponse<T> }): T => res.data.data

export const viewSettingsProfileDefaultsApi = {
  profiles: (signal?: AbortSignal): Promise<ViewSettingsProfile[]> =>
    apiService
      .get<ApiResponse<ViewSettingsProfile[]>>({
        url: `${baseUrl}/profiles`,
        signal,
      })
      .then(unwrap),

  get: (
    screenKey: string,
    profile: string,
    signal?: AbortSignal
  ): Promise<ViewSettingsPatchEntry[]> =>
    apiService
      .get<ApiResponse<ViewSettingsResponse>>({
        url: url(screenKey),
        params: { profile },
        signal,
      })
      .then(unwrap)
      .then((data) => data.patch),

  put: (
    screenKey: string,
    profile: string,
    patch: ViewSettingsPatchEntry[]
  ): Promise<ViewSettingsPatchEntry[]> =>
    apiService
      .put<ApiResponse<ViewSettingsResponse>>({
        url: `${url(screenKey)}?profile=${encodeURIComponent(profile)}`,
        data: { patch },
      })
      .then(unwrap)
      .then((data) => data.patch),

  reset: async (screenKey: string, profile: string): Promise<void> => {
    await apiService.delete({
      url: `${url(screenKey)}?profile=${encodeURIComponent(profile)}`,
    })
  },
}
