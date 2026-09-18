import { useQuery } from '@tanstack/react-query'

import {
  viewSettingsApi,
  viewSettingsDefaultsApi,
  type ViewSettingsPatchEntry,
} from '../../api/view-settings-api'
import {
  viewSettingsProfileDefaultsApi,
  type ViewSettingsProfile,
} from '../../api/view-settings-profile-defaults-api'
import type { CustomizeFormMode } from '../customize-form/customize-form-store'
import { mergePatchLayers } from '../customize-form/merge-patch-layers'

const settingsKey = (screenKey: string, mode: string, profile: string) =>
  ['view-settings', mode, screenKey, profile] as const

/** API выбранного слоя настроек: личный, «для всех» или пер-ролевой. */
export interface ViewSettingsLayerApi {
  get: (
    screenKey: string,
    signal?: AbortSignal
  ) => Promise<ViewSettingsPatchEntry[]>
  put: (
    screenKey: string,
    next: ViewSettingsPatchEntry[]
  ) => Promise<ViewSettingsPatchEntry[]>
  reset: (screenKey: string) => Promise<void>
}

interface UseViewSettingsLayerArgs {
  isOpen: boolean
  mode: CustomizeFormMode
  /** Слой режима default: '' — «для всех», иначе код профиля групп доступа. */
  profile: string
  screenKey: string | null
}

/**
 * Слой настроек вида для диалога «Изменить форму»: выбирает api-объект по
 * режиму/профилю (Ф5: режим «для всех» пишет админский дефолт тем же диалогом,
 * выбранный профиль переключает слой на пер-ролевой с той же семантикой полной
 * замены) и загружает патч выбранного слоя.
 */
export function useViewSettingsLayer({
  isOpen,
  mode,
  profile,
  screenKey,
}: UseViewSettingsLayerArgs): {
  api: ViewSettingsLayerApi
  patch: ViewSettingsPatchEntry[] | undefined
  profiles: ViewSettingsProfile[] | undefined
} {
  const { data: profiles } = useQuery({
    queryKey: ['view-settings-profiles'],
    queryFn: ({ signal }) => viewSettingsProfileDefaultsApi.profiles(signal),
    enabled: isOpen && mode === 'default',
  })

  const api: ViewSettingsLayerApi =
    mode !== 'default'
      ? viewSettingsApi
      : profile === ''
        ? viewSettingsDefaultsApi
        : {
            get: (key: string, signal?: AbortSignal) =>
              viewSettingsProfileDefaultsApi.get(key, profile, signal),
            put: (key: string, next: ViewSettingsPatchEntry[]) =>
              viewSettingsProfileDefaultsApi.put(key, profile, next),
            reset: (key: string) =>
              viewSettingsProfileDefaultsApi.reset(key, profile),
          }

  const { data: patch } = useQuery({
    queryKey: settingsKey(screenKey ?? '', mode, profile),
    // Ролевой слой настраивается ПОВЕРХ «для всех»: редактор сеется слиянием
    // (общий дефолт снизу, ролевой поверх), чтобы админ видел и правил ровно
    // ту раскладку, которую получит роль. Сохранение пишет полный снимок в
    // ролевой слой — дальше роль живёт своей копией, детерминированно.
    queryFn: async ({ signal }) => {
      if (mode === 'default' && profile !== '') {
        const [base, override] = await Promise.all([
          viewSettingsDefaultsApi.get(screenKey ?? '', signal),
          viewSettingsProfileDefaultsApi.get(screenKey ?? '', profile, signal),
        ])
        return mergePatchLayers(base, override)
      }
      return api.get(screenKey ?? '', signal)
    },
    enabled: isOpen && screenKey != null,
  })

  return { api, patch, profiles }
}
