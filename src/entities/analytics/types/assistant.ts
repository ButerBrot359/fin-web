/** ИИ-ассистент и аудит обращений к модели. */

import type { AnalyticsItemKind, AnalyticsSpec } from './spec'

export interface AnalyticsGenerateRequest {
  /** Формулировка пользователя на естественном языке. */
  prompt: string
  kind: AnalyticsItemKind
  /** Продолжение диалога; пусто — начинаем новый. */
  conversationId?: number | null
  /** Текущая спецификация, если пользователь просит её доработать. */
  currentSpec?: AnalyticsSpec | null
  organizationId?: number | null
}

export interface AnalyticsGenerateResponse {
  conversationId: number
  messageId: number
  spec: AnalyticsSpec | null
  /** Пояснение модели: что она построила и на каких данных. */
  explanation?: string | null
  /** Ссылка на запись аудита — открывает панель «Что ушло в ИИ». */
  llmRequestId?: number | null
  /** Замечания, не помешавшие построению: деградация вида виджета и т.п. */
  warnings: string[]
  /** Заполняется, когда спецификацию построить не удалось. */
  error?: string | null
}

export type AnalyticsMessageRole = 'USER' | 'ASSISTANT'

export interface AnalyticsMessage {
  id: number
  role: AnalyticsMessageRole
  content?: string | null
  spec?: AnalyticsSpec | null
  llmRequestId?: number | null
  errorMessage?: string | null
  createdAt: string
}

export interface AnalyticsConversation {
  id: number
  kind: AnalyticsItemKind
  title?: string | null
  itemCode?: string | null
  createdAt: string
  messages: AnalyticsMessage[]
}

/**
 * Запись аудита обращения к LLM.
 *
 * Открывается кнопкой «Что ушло в ИИ» и показывает ровно то, что было
 * отправлено. Это и доказательство соблюдения требования «в ИИ уходит только
 * структура данных», и способ понять, почему модель ошиблась.
 */
export interface AnalyticsLlmRequest {
  id: number
  stage: string
  provider: string
  model: string
  systemPrompt?: string | null
  userPrompt?: string | null
  responseText?: string | null
  inputTokens: number
  outputTokens: number
  latencyMs: number
  success: boolean
  errorMessage?: string | null
  createdAt: string
}
