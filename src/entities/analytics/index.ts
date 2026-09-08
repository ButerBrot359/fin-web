/**
 * Публичный API слайса «Аналитика» — единственный barrel раздела.
 *
 * Раздел изолирован: он импортирует только `@/shared/**` и свои файлы, и
 * ничего не берёт ни из SDUI, ни из легаси-контура. Всё, чем пользуются
 * страницы и виджеты раздела, проходит через этот файл.
 */

export { analyticsApi } from './api/analytics-api'
export type { AnalyticsCatalogRebuildResult } from './api/analytics-api'

export { analyticsKeys } from './lib/query-keys'

export { useAnalyticsCatalogIndex } from './lib/hooks/use-analytics-catalog'
export { useAnalyticsDataset } from './lib/hooks/use-analytics-dataset'
export { useWidgetKinds } from './lib/hooks/use-widget-kinds'
export {
  useAnalyticsItems,
  useAnalyticsItem,
  useSaveAnalyticsItem,
  useDeleteAnalyticsItem,
} from './lib/hooks/use-analytics-items'
export {
  useAiSettings,
  useUpdateAiSettings,
  useAiModels,
  useTestAiSettings,
} from './lib/hooks/use-ai-settings'
export { useGenerateSpec } from './lib/hooks/use-generate-spec'
export { useConversation, useLlmRequest } from './lib/hooks/use-conversation'

export type {
  AnalyticsAggregate,
  AnalyticsAllowedValue,
  AnalyticsColumn,
  AnalyticsDataset,
  AnalyticsEncoding,
  AnalyticsFieldRef,
  AnalyticsItemKind,
  AnalyticsLayout,
  AnalyticsParameter,
  AnalyticsParameterType,
  AnalyticsSort,
  AnalyticsSpec,
  AnalyticsValueFormat,
  AnalyticsValueType,
  AnalyticsWidget,
  AnalyticsWidgetPosition,
  AnalyticsWidgetType,
} from './types/spec'

export type {
  AnalyticsQueryColumn,
  AnalyticsQueryRequest,
  AnalyticsQueryResult,
  AnalyticsSqlValidation,
} from './types/query'

export type {
  AnalyticsConversation,
  AnalyticsGenerateRequest,
  AnalyticsGenerateResponse,
  AnalyticsLlmRequest,
  AnalyticsMessage,
  AnalyticsMessageRole,
} from './types/assistant'

export type {
  AnalyticsAiSettings,
  AnalyticsAiSettingsUpdate,
  AnalyticsAiTestResult,
  AnalyticsModel,
  LlmProvider,
} from './types/ai-settings'

export type {
  AnalyticsCatalogColumn,
  AnalyticsCatalogIndexItem,
  AnalyticsCatalogView,
  AnalyticsItem,
  AnalyticsItemSaveRequest,
  AnalyticsItemSummary,
  AnalyticsWidgetKind,
} from './types/item'
