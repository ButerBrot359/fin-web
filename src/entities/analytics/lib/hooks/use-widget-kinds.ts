import { useQuery } from '@tanstack/react-query'

import { analyticsApi } from '../../api/analytics-api'
import { analyticsKeys } from '../query-keys'
import type { AnalyticsWidgetKind } from '../../types/item'

/**
 * Реестр видов виджетов с бэкенда: какие слоты `encoding` обязательны, нужен
 * ли виду датасет и считается ли нулевой результат валидным.
 *
 * Фронт эти правила не дублирует — иначе рендер и валидация спецификации
 * разъезжаются при добавлении нового вида. Реестр статичен в пределах релиза,
 * поэтому кэшируем его на всю сессию.
 */
export const useWidgetKinds = (): {
  kinds: AnalyticsWidgetKind[]
  isLoading: boolean
} => {
  const { data, isLoading } = useQuery({
    queryKey: analyticsKeys.widgetKinds(),
    queryFn: ({ signal }) => analyticsApi.getWidgetKinds(signal),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  return { kinds: data ?? [], isLoading }
}
