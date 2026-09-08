import { useQuery } from '@tanstack/react-query'

import { analyticsApi } from '../../api/analytics-api'
import { analyticsKeys } from '../query-keys'
import type { AnalyticsCatalogIndexItem } from '../../types/item'

/**
 * Индекс витрин данных: имена, бизнес-названия и оценка объёма.
 *
 * Каталог меняется только при пересборке (перенос метаданных из 1С), поэтому
 * держим его в кэше долго — на каждое открытие ассистента он не перезапрашивается.
 * Названия приходят сразу на двух языках (`titleRu`/`titleKz`), сервер ответ не
 * локализует — язык в ключ кэша не входит.
 */
export const useAnalyticsCatalogIndex = (): {
  views: AnalyticsCatalogIndexItem[]
  isLoading: boolean
} => {
  const { data, isLoading } = useQuery({
    queryKey: analyticsKeys.catalog(),
    queryFn: ({ signal }) => analyticsApi.getCatalogIndex(signal),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })

  return { views: data ?? [], isLoading }
}
