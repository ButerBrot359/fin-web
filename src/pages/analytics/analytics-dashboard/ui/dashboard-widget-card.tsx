import { useEffect } from 'react'

import { useAnalyticsDataset } from '@/entities/analytics'
import type { AnalyticsSpec, AnalyticsWidget } from '@/entities/analytics'
import { WidgetHost } from '@/features/analytics-widgets'

interface DashboardWidgetCardProps {
  widget: AnalyticsWidget
  spec: AnalyticsSpec
  /** Раскрытые значения параметров (`expandParams`). */
  params: Record<string, unknown>
  enabled: boolean
  /** Счётчик кнопки «Обновить»: рост значения перезапрашивает данные. */
  refreshToken: number
}

/**
 * Один виджет дашборда: сам находит свой датасет и сам выполняет запрос.
 *
 * Именно поэтому виджет — отдельный компонент: `useAnalyticsDataset` нельзя
 * вызывать в цикле по `spec.widgets`.
 */
export const DashboardWidgetCard = ({
  widget,
  spec,
  params,
  enabled,
  refreshToken,
}: DashboardWidgetCardProps) => {
  const dataset =
    spec.datasets.find((item) => item.id === widget.datasetId) ?? null

  // Хук вызывается всегда — у виджетов без датасета (TEXT) запрос выключен.
  const { result, isLoading, isError, error, refetch } = useAnalyticsDataset(
    dataset,
    params,
    enabled
  )

  useEffect(() => {
    if (refreshToken > 0 && dataset != null) void refetch()
  }, [refreshToken]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <WidgetHost
      widget={widget}
      specColumns={dataset?.columns ?? []}
      result={result}
      isLoading={isLoading}
      error={isError ? error : undefined}
      onRefresh={() => {
        void refetch()
      }}
    />
  )
}
