import type { LlmProvider } from '@/entities/analytics'

// Реестр провайдеров (PROVIDER_OPTIONS) живёт в `@/entities/ai-connection` —
// он общий для настроек аналитики и подключений помощника.

/**
 * Значения формы, когда настроек ещё нет (первый вход в организацию или
 * бэкенд недоступен). Температура низкая: ассистент строит SQL и спецификацию,
 * разброс ответов здесь вреден.
 */
export const DEFAULT_PROVIDER: LlmProvider = 'ANTHROPIC'
export const DEFAULT_TEMPERATURE = 0.2
export const DEFAULT_MAX_TOKENS = 8192

export const TEMPERATURE_MIN = 0
export const TEMPERATURE_MAX = 1
export const TEMPERATURE_STEP = 0.1

export const MAX_TOKENS_MIN = 256
export const MAX_TOKENS_MAX = 200_000
