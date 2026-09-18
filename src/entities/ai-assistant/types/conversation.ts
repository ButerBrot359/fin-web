import type { AiAssistantAnswer } from './ai-assistant'

/** История переписки с помощником. */

export interface AiConversation {
  id: number
  title: string
  contextType?: string | null
  contextId?: number | null
  createdAt: string
}

export interface AiConversationMessage {
  id: number
  /** TOOL — то, что помощник прочитал из базы для ответа. */
  role: 'USER' | 'ASSISTANT' | 'TOOL'
  content: string
  /** Полный сохранённый ответ; в старых сообщениях может отсутствовать. */
  answer?: Partial<AiAssistantAnswer> | null
  error?: string | null
  toolName?: string | null
  createdAt: string
}

export interface AiConversationMessagePage {
  messages: AiConversationMessage[]
  nextBeforeId: number | null
  hasMore: boolean
}

export interface AiConversationPage {
  conversations: AiConversation[]
  nextBeforeId: number | null
  hasMore: boolean
}
