import { useCallback, useRef, useState } from 'react'

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
  const nextId = useCallback(() => {
    seq.current += 1
    return `m${String(seq.current)}`
  }, [])

  const { mutate, isPending } = useGenerateSpec()

  const push = useCallback((message: AssistantChatMessage) => {
    setMessages((prev) => [...prev, message])
  }, [])

  const handleResponse = useCallback(
    (response: AnalyticsGenerateResponse) => {
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
    },
    [nextId, push]
  )

  const handleError = useCallback(
    (error: unknown) => {
      push({
        id: nextId(),
        role: 'ASSISTANT',
        text: '',
        error: extractErrorText(error) ?? '',
      })
    },
    [nextId, push]
  )

  const send = useCallback(
    (prompt: string) => {
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
    },
    [
      conversationId,
      currentSpec,
      handleError,
      handleResponse,
      isPending,
      kind,
      mutate,
      nextId,
      push,
    ]
  )

  const reset = useCallback(() => {
    setMessages([])
    setCurrentSpec(null)
    setConversationId(null)
  }, [])

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
