/** Подключение к ИИ: провайдер, адрес, ключ и модель, описанные один раз. */

import type { LlmProvider } from '@/entities/analytics'

export interface AiConnection {
  id: number
  /** Человекочитаемое имя: по нему подключение выбирают в контурах. */
  name: string
  provider: LlmProvider
  model: string
  baseUrl?: string | null
  hasApiKey: boolean
  apiKeyMask?: string | null
  temperature: number
  maxTokens: number
  /** Данные уходят стороннему провайдеру — всё, кроме своей модели. */
  external: boolean
  usedBy: ('ANALYTICS' | 'ASSISTANT')[]
  updatedAt?: string | null
}

export interface AiConnectionUpdate {
  name: string
  provider: LlmProvider
  model: string
  baseUrl: string | null
  /** Пусто — оставить сохранённый ключ, а не стереть. */
  apiKey: string | null
  temperature: number
  maxTokens: number
}

export interface AiConnectionTestResult {
  success: boolean
  message?: string | null
  latencyMs?: number | null
  model?: string | null
}
