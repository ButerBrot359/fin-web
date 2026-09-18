import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { analyticsApi } from '../../api/analytics-api'
import { useAnalyticsOrganizationStore } from '../../model/organization-store'
import { analyticsKeys } from '../query-keys'
import type { AnalyticsDataset } from '../../types/spec'
import type { AnalyticsQueryResult } from '../../types/query'

interface UseAnalyticsDatasetResult {
  result: AnalyticsQueryResult | null
  isLoading: boolean
  isError: boolean
  error: unknown
  /**
   * Возвращает промис, а не `void`: у вызывающих принято отбрасывать его через
   * `void refetch()`, а под `no-meaningless-void-operator` такая запись
   * допустима только для непустого результата. Тип по-прежнему присваивается
   * `() => void`, поэтому вызов без `void` тоже валиден.
   */
  refetch: () => Promise<unknown>
}

/**
 * Выполнение датасета спецификации — общий вход для каждого виджета дашборда
 * и для страницы отчёта.
 *
 * Ключ кэша — хэш SQL плюс сериализованные параметры: несколько виджетов на
 * одном датасете с одинаковыми параметрами выполняют ровно один запрос.
 * `sqlHash` уходит на бэкенд вместе с SQL: расхождение означает, что клиент
 * работает с устаревшей спецификацией, и бэкенд отвечает 409.
 *
 * Организация берётся из общего выбора раздела здесь, а не приходит пропсом:
 * это единственный вход на выполнение, и так ни один виджет не выполнится мимо
 * выбора. Не выбрана — сервер показывает все организации.
 *
 * `retry: false` — повторять отклонённый guardrails SQL бессмысленно, ответ не
 * изменится; `refetchOnWindowFocus: false` — запросы аналитики тяжёлые, они
 * пересобираются по кнопке и по смене параметров, а не при возврате на вкладку.
 */
export const useAnalyticsDataset = (
  dataset: AnalyticsDataset | null | undefined,
  params: Record<string, unknown>,
  enabled: boolean
): UseAnalyticsDatasetResult => {
  // Датасету уходят ТОЛЬКО объявленные им параметры. Панель параметров общая на
  // спецификацию, но у каждого запроса свой набор: guardrails отвергают запрос, в
  // котором есть параметр, не встречающийся в SQL. Побочно это чинит и кэш — KPI
  // не перезапрашивается, когда меняется параметр, который его не касается.
  const datasetParams = useMemo(() => {
    if (!dataset) return {}
    const declared = dataset.parameters
    if (declared.length === 0) return {}
    return Object.fromEntries(
      Object.entries(params).filter(([key]) => declared.includes(key))
    )
  }, [dataset, params])

  const serializedParams = JSON.stringify(datasetParams)
  const organizationId = useAnalyticsOrganizationStore(
    (state) => state.organizationId
  )

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: analyticsKeys.dataset(
      dataset?.sqlHash ?? '',
      serializedParams,
      organizationId
    ),
    queryFn: ({ signal }) =>
      analyticsApi.executeQuery(
        {
          sql: dataset!.sql,
          sqlHash: dataset!.sqlHash,
          parameters: datasetParams,
          organizationId,
        },
        signal
      ),
    enabled: enabled && !!dataset,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  return {
    result: data ?? null,
    isLoading: isLoading || isFetching,
    isError,
    error,
    refetch,
  }
}
