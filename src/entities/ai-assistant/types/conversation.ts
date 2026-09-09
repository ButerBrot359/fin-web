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
  toolName?: string | null
  createdAt: string
}
