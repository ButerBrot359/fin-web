import { apiService } from '@/shared/api/api'
import type { ApiResponse } from '@/shared/types/api.types'

import type { ThemeTokens } from '../types/theme'

/**
 * Пер-пользовательская тема (конструктор дизайна Ф3, спека 2026-09-10 §1.2).
 * `/api/theme` — слитое «дефолт ⊕ override» для применения на старте;
 * `/api/theme-settings` — CRUD override'ов, PUT — полная замена
 * (undo клиента = PUT прежнего набора).
 */

interface ThemeSettingsResponse {
  tokens: ThemeTokens
}

const unwrap = <T>(res: { data: ApiResponse<T> }): T => res.data.data

export const themeApi = {
  getTheme: (signal?: AbortSignal): Promise<ThemeTokens> =>
    apiService
      .get<ApiResponse<ThemeSettingsResponse>>({ url: '/api/theme', signal })
      .then(unwrap)
      .then((data) => data.tokens),

  getOverrides: (signal?: AbortSignal): Promise<ThemeTokens> =>
    apiService
      .get<ApiResponse<ThemeSettingsResponse>>({
        url: '/api/theme-settings',
        signal,
      })
      .then(unwrap)
      .then((data) => data.tokens),

  putOverrides: (tokens: ThemeTokens): Promise<ThemeTokens> =>
    apiService
      .put<ApiResponse<ThemeSettingsResponse>>({
        url: '/api/theme-settings',
        data: { tokens },
      })
      .then(unwrap)
      .then((data) => data.tokens),

  reset: async (): Promise<void> => {
    await apiService.delete({ url: '/api/theme-settings' })
  },
}
