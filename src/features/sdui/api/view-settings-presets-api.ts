import { apiService } from '@/shared/api/api'
import type { ApiResponse } from '@/shared/types/api.types'

import type { ViewSettingsPatchEntry } from './view-settings-api'

/**
 * Каталог пресетов настроек экрана — «поделиться настройками» конструктора.
 * Публикация фиксирует патч и роли автора на бэке; список отдаёт только
 * пресеты, чьи роли пересекаются с ролями смотрящего (фильтрует сервер,
 * фронт ролевой логики не знает). Применение пресета — обычный PUT патча
 * в свои настройки, отдельной ручки нет.
 */

export interface ViewSettingsPresetSummary {
  id: number
  name: string
  authorName: string | null
  mine: boolean
  updatedAt: string | null
}

interface PresetPatchResponse {
  patch: ViewSettingsPatchEntry[]
}

const baseUrl = '/api/view-settings-presets'

const unwrap = <T>(res: { data: ApiResponse<T> }): T => res.data.data

export const viewSettingsPresetsApi = {
  publish: (
    screenKey: string,
    name: string,
    patch: ViewSettingsPatchEntry[]
  ): Promise<ViewSettingsPresetSummary> =>
    apiService
      .post<ApiResponse<ViewSettingsPresetSummary>>({
        url: baseUrl,
        data: { screenKey, name, patch },
      })
      .then(unwrap),

  list: (
    screenKey: string,
    search: string,
    signal?: AbortSignal
  ): Promise<ViewSettingsPresetSummary[]> =>
    apiService
      .get<ApiResponse<ViewSettingsPresetSummary[]>>({
        url: baseUrl,
        params: { screenKey, search: search || undefined },
        signal,
      })
      .then(unwrap),

  getPatch: (id: number): Promise<ViewSettingsPatchEntry[]> =>
    apiService
      .get<ApiResponse<PresetPatchResponse>>({
        url: `${baseUrl}/${String(id)}`,
      })
      .then(unwrap)
      .then((data) => data.patch),

  remove: async (id: number): Promise<void> => {
    await apiService.delete({ url: `${baseUrl}/${String(id)}` })
  },
}
