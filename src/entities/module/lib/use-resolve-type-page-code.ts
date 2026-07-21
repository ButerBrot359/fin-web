import { useQuery, useQueries } from '@tanstack/react-query'

import { apiService } from '@/shared/api/api'
import type { ApiResponse } from '@/shared/types/api.types'

import { getModule } from '../api/module'
import type { ModuleItems } from '../types/module'
import { resolveTypePageCode } from './resolve-type-page-code'

interface ModuleListItem {
  code: string
  sortOrder: number
}

const STALE_TIME = 5 * 60 * 1000

interface ResolveResult {
  isResolving: boolean
  pageCode: string | undefined
}

/**
 * Резолвит раздел (pageCode) для типа (документа/справочника): список модулей + перебор их
 * метаданных в порядке сайдбара. queryKey по-модульных запросов совпадает с
 * useModule — кэш общий, уже открытые разделы не перезапрашиваются.
 */
export function useResolveTypePageCode(typeCode: string): ResolveResult {
  const modulesQuery = useQuery({
    queryKey: ['settings', 'modules'],
    queryFn: () =>
      apiService.get<ApiResponse<ModuleListItem[]>>({
        url: '/api/settings/modules',
      }),
    staleTime: STALE_TIME,
    select: (res) =>
      [...res.data.data]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((m) => m.code),
  })

  const moduleCodes = modulesQuery.data ?? []

  const moduleQueries = useQueries({
    queries: moduleCodes.map((code) => ({
      queryKey: ['settings', 'modules', code],
      queryFn: () => getModule(code),
      staleTime: STALE_TIME,
    })),
  })

  if (modulesQuery.isPending || moduleQueries.some((q) => q.isPending)) {
    return { isResolving: true, pageCode: undefined }
  }

  const itemsByModuleCode: Record<string, ModuleItems | undefined> = {}
  moduleCodes.forEach((code, i) => {
    // Упавший запрос модуля → data undefined → модуль пропускается в переборе
    itemsByModuleCode[code] = moduleQueries[i].data?.data.data.items
  })

  return {
    isResolving: false,
    pageCode: resolveTypePageCode(moduleCodes, itemsByModuleCode, typeCode),
  }
}
