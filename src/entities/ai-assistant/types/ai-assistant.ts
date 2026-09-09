/** Контур ИИ-помощника: чат поверх формы. */

import type { LlmProvider } from '@/entities/analytics'

/** Объект, поверх которого открыт помощник. Содержимое сервер читает сам. */
export interface AiAssistantContext {
  kind:
    | 'DOCUMENT'
    | 'DOCUMENT_LIST'
    | 'DOCUMENT_NEW'
    | 'DICTIONARY'
    | 'DICTIONARY_LIST'
    | 'NONE'
  typeCode?: string | null
  entryId?: number | null
}

export interface AiAssistantChatRequest {
  conversationId?: number | null
  question: string
  context?: AiAssistantContext | null
}

/** Строка расшифровки: из чего сложился результат. */
export interface AiAssistantBreakdownRow {
  label?: string | null
  value?: string | null
  source?: string | null
}

/**
 * Предлагаемое действие.
 *
 * Навигационные (`SHOW_ROWS`, `OPEN_DOCUMENT`) фронт выполняет сразу — они ничего
 * не меняют. `CREATE_DOCUMENT` уходит отдельным подтверждённым вызовом.
 */
export interface AiAssistantAction {
  kind: 'SHOW_ROWS' | 'OPEN_DOCUMENT' | 'CREATE_DOCUMENT'
  label?: string | null
  typeCode?: string | null
  entryId?: number | null
  tableCode?: string | null
  attributes?: Record<string, unknown> | null
  preview?: string | null
  /** Причина неудачи; пусто — действие доступно. Ошибка показывается сообщением, не кнопкой. */
  error?: string | null
}

export interface AiAssistantCreatedDocument {
  entryId: number
  typeCode: string
  presentation: string
  /** Всегда false: помощник документы не проводит. */
  posted: boolean
  warnings: string[]
}

/** Ответ в формате концепции: вывод, расшифровка, источник, действия. */
export interface AiAssistantAnswer {
  conversationId: number
  conclusion: string
  breakdown: AiAssistantBreakdownRow[]
  sources: string[]
  actions: AiAssistantAction[]
  /** Чего не хватило для ответа; пусто — хватило всего. */
  /** Документы, созданные помощником в этом ответе. Всегда не проведённые. */
  created: AiAssistantCreatedDocument[]
  missing?: string | null
  requestLogId?: number | null
  latencyMs: number
}

export interface AiAssistantConfirmAction {
  conversationId?: number | null
  kind: 'CREATE_DOCUMENT'
  typeCode: string
  attributes?: Record<string, unknown> | null
}

/** Настройки помощника — отдельные от настроек аналитики. */
export interface AiAssistantSettings {
  organizationId?: number | null
  /** Выбранное подключение из реестра; пусто — контур не настроен. */
  connectionId?: number | null
  provider: LlmProvider
  model: string
  baseUrl?: string | null
  hasApiKey: boolean
  apiKeyMask?: string | null
  temperature: number
  maxTokens: number
  enabled: boolean
  /** Организация подтвердила отправку учётных данных стороннему провайдеру. */
  externalProviderAcknowledged: boolean
  inheritedFromSystem: boolean
  updatedAt?: string | null
}

export interface AiAssistantSettingsUpdate {
  /** Выбранное подключение из реестра; пусто — контур не настроен. */
  connectionId?: number | null
  provider: LlmProvider
  model: string
  baseUrl: string | null
  apiKey: string | null
  temperature: number
  maxTokens: number
  enabled: boolean
  externalProviderAcknowledged: boolean
}

/**
 * Раскрытие «что уходит в ИИ» по одному контуру.
 *
 * Текст приходит с сервера, а не пишется во фронте: промпт собирает сервер, и
 * список, зашитый в интерфейс, разошёлся бы с правдой при первой правке
 * контекста. Предупреждению, которому нельзя верить, грош цена.
 */
export interface AiDisclosure {
  kind: 'ANALYTICS' | 'ASSISTANT'
  provider: string
  model: string
  /** Данные покидают периметр организации. */
  external: boolean
  severity: 'INFO' | 'WARNING'
  summary: string
  sent: string[]
  neverSent: string[]
  /** Что контур делает с системой: отправка и изменение — разные риски. */
  capabilities: string[]
}
