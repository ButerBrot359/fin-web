import type { AiStatisticsFilters } from '../types/ai-statistics'

/**
 * Ключи кэша раздела «Аналитика».
 *
 * Единственный источник ключей: страницы и виджеты не собирают массивы руками,
 * иначе инвалидация после сохранения промахивается мимо реально живущих
 * запросов. Все ключи начинаются с 'analytics' — сбросить раздел целиком можно
 * по `analyticsKeys.root`.
 */
export const analyticsKeys = {
  root: ['analytics'] as const,
  catalog: () => ['analytics', 'catalog'] as const,
  catalogView: (viewName: string) =>
    ['analytics', 'catalog', viewName] as const,
  widgetKinds: () => ['analytics', 'widget-kinds'] as const,
  items: (kind?: string) => ['analytics', 'items', kind ?? 'all'] as const,
  item: (code: string) => ['analytics', 'item', code] as const,
  aiStatistics: (filters: AiStatisticsFilters) =>
    ['analytics', 'ai-statistics', filters] as const,
  aiSettings: () => ['analytics', 'ai-settings'] as const,
  models: (provider: string, baseUrl?: string) =>
    ['analytics', 'models', provider, baseUrl ?? ''] as const,
  conversation: (id: number) => ['analytics', 'conversation', id] as const,
  llmRequest: (id: number) => ['analytics', 'llm-request', id] as const,
  organizations: () => ['analytics', 'organizations'] as const,
  /**
   * Результат датасета кэшируется по хэшу SQL, значениям параметров и
   * организации: два виджета на одном датасете с одинаковыми параметрами делят
   * один запрос, а смена организации перезапрашивает всё, что на экране.
   */
  dataset: (sqlHash: string, params: string, organizationId: number | null) =>
    ['analytics', 'execute', sqlHash, params, organizationId ?? 'all'] as const,
}
