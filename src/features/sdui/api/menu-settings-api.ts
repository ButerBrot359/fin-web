import { apiService } from '@/shared/api/api'
import type { ApiResponse } from '@/shared/types/api.types'

/**
 * Конструктор меню (SCRUM-426, спека 2026-09-24 §3.6): слои настроек бокового меню
 * и разделов модулей. PUT — ПОЛНАЯ ЗАМЕНА патча слоя; мерж слоёв делает бэк,
 * клиент готовое меню не патчит (принцип конструктора дизайна).
 */

export interface MenuPatchEntry {
  hidden?: boolean
  order?: number
}

export type MenuSettingsPatch = Record<string, MenuPatchEntry>

export interface MenuStructureElement {
  key: string
  nameRu: string
  nameKz: string | null
  effectiveHidden: boolean
}

export interface MenuStructureSection {
  key: string
  nameRu: string
  nameKz: string | null
  effectiveHidden: boolean
  elements: MenuStructureElement[]
}

export interface MenuStructureModule {
  key: string
  code: string
  nameRu: string
  nameKz: string | null
  iconCode: string | null
  effectiveHidden: boolean
  sections: MenuStructureSection[]
}

export interface MenuStructure {
  modules: MenuStructureModule[]
  patch: MenuSettingsPatch
}

export type MenuScope =
  | { kind: 'my' }
  | { kind: 'global' }
  | { kind: 'profile'; profileKey: string }
  | { kind: 'user'; userKey: string }

export interface MenuSettingsOption {
  key: string
  name: string
}

/** Пресет «поделиться конфигурацией меню» (решение владельца 25.09). */
export interface MenuPreset {
  id: number
  name: string
  authorName: string | null
  mine: boolean
  updatedAt: string
}

interface MenuSettingsResponse {
  patch: MenuSettingsPatch
}

const layerUrl = (scope: MenuScope): string => {
  switch (scope.kind) {
    case 'my':
      return '/api/menu-settings/my'
    case 'global':
      return '/api/menu-settings/global'
    case 'profile':
      return `/api/menu-settings/profiles/${encodeURIComponent(scope.profileKey)}`
    case 'user':
      return `/api/menu-settings/users/${encodeURIComponent(scope.userKey)}`
  }
}

const structureUrl = (scope: MenuScope): string => {
  const params = new URLSearchParams()
  if (scope.kind === 'profile') {
    params.set('scope', 'profile')
    params.set('profileKey', scope.profileKey)
  } else if (scope.kind === 'user') {
    params.set('scope', 'user')
    params.set('userEntryId', scope.userKey)
  } else {
    params.set('scope', scope.kind)
  }
  return `/api/menu-settings/structure?${params.toString()}`
}

const unwrap = <T>(res: { data: ApiResponse<T> }): T => res.data.data

export const menuSettingsApi = {
  me: (signal?: AbortSignal): Promise<{ canManage: boolean }> =>
    apiService
      .get<
        ApiResponse<{ canManage: boolean }>
      >({ url: '/api/menu-settings/me', signal })
      .then(unwrap),

  structure: (scope: MenuScope, signal?: AbortSignal): Promise<MenuStructure> =>
    apiService
      .get<ApiResponse<MenuStructure>>({ url: structureUrl(scope), signal })
      .then(unwrap),

  getPatch: (
    scope: MenuScope,
    signal?: AbortSignal
  ): Promise<MenuSettingsPatch> =>
    apiService
      .get<ApiResponse<MenuSettingsResponse>>({ url: layerUrl(scope), signal })
      .then(unwrap)
      .then((data) => data.patch),

  putPatch: async (
    scope: MenuScope,
    patch: MenuSettingsPatch
  ): Promise<void> => {
    await apiService.put({ url: layerUrl(scope), data: { patch } })
  },

  resetPatch: async (scope: MenuScope): Promise<void> => {
    await apiService.delete({ url: layerUrl(scope) })
  },

  // Бэк переиспользует ViewSettingsProfileDto ({code, name}) — приводим к {key, name}.
  profiles: (signal?: AbortSignal): Promise<MenuSettingsOption[]> =>
    apiService
      .get<ApiResponse<{ code: string; name: string }[]>>({
        url: '/api/menu-settings/profiles',
        signal,
      })
      .then(unwrap)
      .then((list) => list.map((p) => ({ key: p.code, name: p.name }))),

  users: (signal?: AbortSignal): Promise<MenuSettingsOption[]> =>
    apiService
      .get<
        ApiResponse<MenuSettingsOption[]>
      >({ url: '/api/menu-settings/users', signal })
      .then(unwrap),

  // Пресеты: публикация — от своего имени, каталог — по пересечению ролей,
  // применение = обычный PUT патча пресета в личный слой применившего.
  publishPreset: (
    name: string,
    patch: MenuSettingsPatch
  ): Promise<MenuPreset> =>
    apiService
      .post<ApiResponse<MenuPreset>>({
        url: '/api/menu-settings/presets',
        data: { name, patch },
      })
      .then(unwrap),

  presets: (signal?: AbortSignal): Promise<MenuPreset[]> =>
    apiService
      .get<
        ApiResponse<MenuPreset[]>
      >({ url: '/api/menu-settings/presets', signal })
      .then(unwrap),

  presetPatch: (id: number): Promise<MenuSettingsPatch> =>
    apiService
      .get<ApiResponse<MenuSettingsResponse>>({
        url: `/api/menu-settings/presets/${String(id)}`,
      })
      .then(unwrap)
      .then((data) => data.patch),

  deletePreset: async (id: number): Promise<void> => {
    await apiService.delete({
      url: `/api/menu-settings/presets/${String(id)}`,
    })
  },
}
