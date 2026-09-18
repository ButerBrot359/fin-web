import { useRef, useState } from 'react'

import { useGenerateSpec } from '@/entities/analytics'
import type {
  AnalyticsGenerateResponse,
  AnalyticsItemKind,
  AnalyticsSpec,
} from '@/entities/analytics'

import { extractErrorText } from '../utils/assistant-error'

/** Сообщение ленты диалога. Живёт только в памяти вкладки. */
export interface AssistantChatMessage {
  id: string
  role: 'USER' | 'ASSISTANT'
  text: string
  spec?: AnalyticsSpec | null
  llmRequestId?: number | null
  sourceViews?: string[]
  warnings?: string[]
  /** Текст ошибки: и `response.error`, и падение самой мутации. */
  error?: string | null
}

export interface AssistantSession {
  messages: AssistantChatMessage[]
  /** Последняя построенная спецификация — она же источник предпросмотра. */
  currentSpec: AnalyticsSpec | null
  conversationId: number | null
  kind: AnalyticsItemKind
  isPending: boolean
  setKind: (kind: AnalyticsItemKind) => void
  send: (prompt: string) => void
  reset: () => void
}

/**
 * Состояние диалога с ассистентом.
 *
 * Каждая отправка передаёт `currentSpec`: так работает уточнение уже
 * построенного представления («добавь график по месяцам») — модель правит
 * существующую спецификацию, а не собирает всё заново.
 */
export const useAssistantSession = (
  initialKind: AnalyticsItemKind = 'DASHBOARD'
): AssistantSession => {
  const [messages, setMessages] = useState<AssistantChatMessage[]>([])
  const [currentSpec, setCurrentSpec] = useState<AnalyticsSpec | null>(null)
  const [conversationId, setConversationId] = useState<number | null>(null)
  const [kind, setKind] = useState<AnalyticsItemKind>(initialKind)

  const seq = useRef(0)
  const nextId = (): string => {
    seq.current += 1
    return `m${String(seq.current)}`
  }

  const { mutate, isPending } = useGenerateSpec()

  const push = (message: AssistantChatMessage): void => {
    setMessages((prev) => [...prev, message])
  }

  const handleResponse = (response: AnalyticsGenerateResponse): void => {
    setConversationId(response.conversationId)
    if (response.spec) setCurrentSpec(response.spec)
    push({
      id: nextId(),
      role: 'ASSISTANT',
      text: response.explanation ?? '',
      spec: response.spec,
      llmRequestId: response.llmRequestId,
      sourceViews: response.spec?.sourceViews ?? [],
      warnings: response.warnings,
      error: response.error,
    })
  }

  const handleError = (error: unknown): void => {
    push({
      id: nextId(),
      role: 'ASSISTANT',
      text: '',
      error: extractErrorText(error) ?? '',
    })
  }

  const send = (prompt: string): void => {
    const text = prompt.trim()
    if (!text || isPending) return

    push({ id: nextId(), role: 'USER', text })
    mutate(
      {
        prompt: text,
        kind,
        conversationId,
        currentSpec,
      },
      { onSuccess: handleResponse, onError: handleError }
    )
  }

  const reset = (): void => {
    setMessages([])
    setCurrentSpec(null)
    setConversationId(null)
  }

  return {
    messages,
    currentSpec,
    conversationId,
    kind,
    isPending,
    setKind,
    send,
    reset,
  }
}
