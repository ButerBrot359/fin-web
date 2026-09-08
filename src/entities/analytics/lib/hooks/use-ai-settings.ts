import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'

import { analyticsApi } from '../../api/analytics-api'
import { analyticsKeys } from '../query-keys'
import type {
  AnalyticsAiSettings,
  AnalyticsAiSettingsUpdate,
  AnalyticsAiTestResult,
  AnalyticsModel,
  LlmProvider,
} from '../../types/ai-settings'

/**
 * Настройки ИИ организации. Сам ключ бэкенд не отдаёт никогда — только маску
 * и признак `hasApiKey`, поэтому кэшировать ответ безопасно.
 */
export const useAiSettings = (): {
  settings: AnalyticsAiSettings | null
  isLoading: boolean
  isError: boolean
} => {
  const { data, isLoading, isError } = useQuery({
    queryKey: analyticsKeys.aiSettings(),
    queryFn: ({ signal }) => analyticsApi.getAiSettings(signal),
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  return { settings: data ?? null, isLoading, isError }
}

export const useUpdateAiSettings = (): UseMutationResult<
  AnalyticsAiSettings,
  unknown,
  AnalyticsAiSettingsUpdate
> => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: AnalyticsAiSettingsUpdate) =>
      analyticsApi.updateAiSettings(request),
    onSuccess: (settings) => {
      // Кладём ответ сразу в кэш: форма перечитывает маску ключа и признак
      // `inheritedFromSystem` уже из сохранённого состояния.
      queryClient.setQueryData(analyticsKeys.aiSettings(), settings)
      void queryClient.invalidateQueries({
        queryKey: analyticsKeys.aiSettings(),
      })
    },
  })
}

/**
 * Каталог моделей выбранного провайдера.
 *
 * `enabled` держит запрос выключенным, пока пользователь не открыл список: у
 * OpenRouter это сотни моделей, тянуть их на каждое открытие страницы незачем.
 * Ошибка загрузки не блокирует форму — идентификатор модели всегда можно
 * ввести вручную.
 */
export const useAiModels = (
  provider: LlmProvider,
  baseUrl: string | undefined,
  enabled: boolean
): {
  models: AnalyticsModel[]
  isLoading: boolean
  isError: boolean
  /** Промис, а не `void` — как у `useAnalyticsDataset`, см. пояснение там. */
  refetch: () => Promise<unknown>
} => {
  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: analyticsKeys.models(provider, baseUrl),
    queryFn: ({ signal }) => analyticsApi.getModels(provider, baseUrl, signal),
    enabled,
    retry: false,
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  })

  return {
    models: data ?? [],
    isLoading: isLoading || isFetching,
    isError,
    refetch,
  }
}

/** Проверка подключения: пробный запрос к провайдеру сохранённым ключом. */
export const useTestAiSettings = (): UseMutationResult<
  AnalyticsAiTestResult,
  unknown,
  void
> =>
  useMutation({
    mutationFn: () => analyticsApi.testAiSettings(),
  })
