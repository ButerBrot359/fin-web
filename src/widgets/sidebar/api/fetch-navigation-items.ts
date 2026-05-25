import i18n from '@/app/config/i18n'
import { apiService } from '@/shared/api/api'
import type { ApiResponse } from '@/shared/types/api.types'

import { ICON_MAP, FALLBACK_ICON, MAIN_NAV_ITEM } from '../lib/consts/navigation-items'
import type { NavigationItem } from '../types/types'

interface ModuleNavItem {
  code: string
  nameRu: string
  nameKz: string
  iconCode: string
  sortOrder: number
}

export async function fetchNavigationItems(): Promise<NavigationItem[]> {
  try {
    const response = await apiService.get<ApiResponse<ModuleNavItem[]>>({
      url: '/api/settings/modules',
    })
    const modules = response.data.data.map((m): NavigationItem => ({
      id: m.code,
      label: i18n.language === 'kz' ? m.nameKz : m.nameRu,
      icon: ICON_MAP[m.iconCode] ?? FALLBACK_ICON,
      path: `/modules/${m.code}`,
    }))
    return [MAIN_NAV_ITEM, ...modules]
  } catch {
    return [MAIN_NAV_ITEM]
  }
}
