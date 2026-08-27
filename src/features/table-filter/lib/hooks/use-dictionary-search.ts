import { useTranslation } from 'react-i18next'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { AxiosResponse } from 'axios'

import { apiService } from '@/shared/api/api'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'
import type { SelectOption } from '@/shared/types/select-option'

interface DictionaryEntry {
  id: number
  code: string
  displayName?: string
  nameRu?: string
  nameKz?: string
}

interface DictionarySearchResponse {
  data: { content: DictionaryEntry[] }
}

/**
 * Серверный поиск по словарю для автокомплитов (фильтры, критерии списков):
 * клиент не строит собственного сопоставления id → name. Ключ кэша общий —
 * одинаковый url+query отдают один и тот же результат.
 */
export function useDictionarySearch(
  url: string | null,
  enabled: boolean,
  query: string
): UseQueryResult<SelectOption[], unknown> {
  const { i18n } = useTranslation()
  return useQuery<
    AxiosResponse<DictionarySearchResponse>,
    unknown,
    SelectOption[]
  >({
    queryKey: ['filter-dict-search', url, query],
    queryFn: () =>
      apiService.get<DictionarySearchResponse>({
        url: url ?? '',
        params: { q: query, size: 30 },
      }),
    enabled: !!url && enabled,
    select: (response) =>
      response.data.data.content.map(
        (entry): SelectOption => ({
          id: entry.id,
          code: entry.code,
          label:
            (entry.displayName ?? getLocalizedName(entry, i18n.language)) ||
            entry.code,
          raw: entry as unknown as Record<string, unknown>,
        })
      ),
  })
}
