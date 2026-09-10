/** Контур ИИ-помощника: чат поверх формы. */

import type { LlmProvider } from '@/entities/analytics'

/**
 * Что помощнику разрешено делать.
 *
 * Умеет он всё перечисленное; галочки решают, что позволено. Тот же набор проверяется
 * на сервере перед каждым действием.
 */
export type AiAssistantCapability =
  | 'SEARCH_DATA'
  | 'QUERY_TOTALS'
  | 'READ_MOVEMENTS'
  | 'RUN_REPORT'
  | 'PRINT_DOCUMENT'
  | 'CREATE_DOCUMENT'
  | 'UPDATE_DOCUMENT'
  | 'POST_DOCUMENT'
  | 'UNPOST_DOCUMENT'
  | 'DELETE_DOCUMENT'
  | 'CREATE_DICTIONARY_ENTRY'
  | 'UPDATE_DICTIONARY_ENTRY'

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
  kind:
    | 'SHOW_ROWS'
    | 'OPEN_DOCUMENT'
    | 'PRINT_DOCUMENT'
    | 'CREATE_DOCUMENT'
    // Изменения сервер выполняет в ходе ответа; неудачи приходят с error.
    | 'COPY_DOCUMENT'
    | 'UPDATE_DOCUMENT'
    | 'POST_DOCUMENT'
    | 'UNPOST_DOCUMENT'
    | 'DELETE_DOCUMENT'
    | 'RESTORE_DOCUMENT'
    | 'CREATE_DICTIONARY_ENTRY'
    | 'UPDATE_DICTIONARY_ENTRY'
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
  /** Фактическое состояние документа после действия. */
  posted: boolean
  warnings: string[]
}

/** Ответ в формате концепции: вывод, расшифровка, источник, действия. */
export interface AiAssistantAnswer {
  conversationId: number
  /** Серверное время получения вопроса и формирования ответа, с часовым поясом. */
  userCreatedAt?: string
  createdAt?: string
  conclusion: string
  breakdown: AiAssistantBreakdownRow[]
  sources: string[]
  actions: AiAssistantAction[]
  /** Чего не хватило для ответа; пусто — хватило всего. */
  /** Документы, созданные или изменённые помощником в этом ответе. */
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
  capabilities: AiAssistantCapability[]
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
  /** null — не менять сохранённые; пустой массив — снять все. */
  capabilities: AiAssistantCapability[] | null
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
