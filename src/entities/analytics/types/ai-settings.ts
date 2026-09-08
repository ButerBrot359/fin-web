/** Настройки ИИ на организацию. */

export type LlmProvider = 'ANTHROPIC' | 'OPENAI' | 'OPENROUTER'

/**
 * Настройки, отдаваемые наружу. Сам ключ не возвращается никогда — только
 * маска вида «sk-…a91f» и признак hasApiKey.
 */
export interface AnalyticsAiSettings {
  organizationId?: number | null
  provider: LlmProvider
  model: string
  baseUrl?: string | null
  hasApiKey: boolean
  apiKeyMask?: string | null
  temperature: number
  maxTokens: number
  enabled: boolean
  /** true — настройки унаследованы от системных, организация свои не заводила. */
  inheritedFromSystem: boolean
  updatedAt?: string | null
}

/**
 * Обновление настроек. apiKey отправляем только когда пользователь ввёл новый:
 * пустое поле означает «оставить сохранённый ключ как есть».
 */
export interface AnalyticsAiSettingsUpdate {
  provider: LlmProvider
  model: string
  baseUrl?: string | null
  apiKey?: string | null
  temperature: number
  maxTokens: number
  enabled: boolean
}

/** Модель из каталога провайдера. */
export interface AnalyticsModel {
  id: string
  name: string
  description?: string | null
  contextLength?: number | null
  /** Только OpenRouter: цена за миллион входных/выходных токенов, USD. */
  pricingPrompt?: string | null
  pricingCompletion?: string | null
}

export interface AnalyticsAiTestResult {
  success: boolean
  provider: LlmProvider
  model: string
  latencyMs: number
  message?: string | null
}
