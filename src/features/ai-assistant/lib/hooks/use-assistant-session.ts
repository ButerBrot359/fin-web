import { useCallback, useLayoutEffect, useRef, useState } from 'react'

import {
  useAskAssistant,
  type AiAssistantAnswer,
  type AiAssistantContext,
} from '@/entities/ai-assistant'

/** Реплика в ленте диалога. */
export interface AssistantChatMessage {
  id: string
  role: 'USER' | 'ASSISTANT'
  text: string
  createdAt: string
  answer?: AiAssistantAnswer
  error?: string
}

interface AssistantSession {
  messages: AssistantChatMessage[]
  isPending: boolean
  /** Лента пуста — можно подставить переписку с сервера, ничего не затерев. */
  isEmpty: boolean
  isRestored: boolean
  conversationId: number | null
  prepend: (messages: AssistantChatMessage[]) => void
  send: (question: string) => void
  restore: (
    conversationId: number | null,
    messages: AssistantChatMessage[]
  ) => void
  reset: () => void
  startNewChat: () => void
}

const nextId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const errorText = (error: unknown): string => {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return 'Не удалось получить ответ помощника'
}

/** Диалог по текущему объекту; запоздавшие ответы другого контекста не показываются. */
export const useAssistantSession = (
  context: AiAssistantContext,
  /**
   * Вызывается на каждый успешный ответ — до того, как человек что-то нажмёт.
   *
   * Нужен там, где реагировать надо на сам факт ответа, а не на действие в нём:
   * документ помощник создаёт сам, в ответе, и переход на него — следствие
   * ответа, а не отдельного нажатия.
   */
  onAnswer?: (answer: AiAssistantAnswer) => void
): AssistantSession => {
  const [isRestored, setIsRestored] = useState(false)
  const [messages, setMessages] = useState<AssistantChatMessage[]>([])
  const [conversationId, setConversationId] = useState<number | null>(null)
  const mutation = useAskAssistant()
  const contextKey = JSON.stringify([
    context.kind,
    context.typeCode,
    context.entryId,
  ])
  const [sessionKey, setSessionKey] = useState(contextKey)
  const activeContext = useRef(contextKey)
  const requestVersion = useRef(0)
  const sending = useRef(false)

  useLayoutEffect(() => {
    activeContext.current = contextKey
    requestVersion.current += 1
    sending.current = false
  }, [contextKey])

  if (sessionKey !== contextKey) {
    setSessionKey(contextKey)
    setMessages([])
    setConversationId(null)
    setIsRestored(false)
  }

  const send = useCallback(
    (question: string) => {
      const trimmed = question.trim()
      if (!trimmed || mutation.isPending || sending.current) return
      sending.current = true
      setIsRestored(true)
      const version = requestVersion.current
      const isCurrent = () =>
        activeContext.current === contextKey &&
        requestVersion.current === version

      const userMessageId = nextId()
      const userCreatedAt = new Date().toISOString()
      setMessages((current) => [
        ...current,
        {
          id: userMessageId,
          role: 'USER',
          text: trimmed,
          createdAt: userCreatedAt,
        },
      ])

      mutation.mutate(
        { conversationId, question: trimmed, context },
        {
          onSuccess: (answer) => {
            if (!isCurrent()) return
            sending.current = false
            setConversationId(answer.conversationId)
            setMessages((current) => [
              ...current.map((message) =>
                message.id === userMessageId && answer.userCreatedAt
                  ? { ...message, createdAt: answer.userCreatedAt }
                  : message
              ),
              {
                id: nextId(),
                role: 'ASSISTANT',
                createdAt: answer.createdAt ?? new Date().toISOString(),
                text: answer.conclusion,
                answer,
              },
            ])
            onAnswer?.(answer)
          },
          onError: (error) => {
            if (!isCurrent()) return
            sending.current = false
            setMessages((current) => [
              ...current,
              {
                id: nextId(),
                role: 'ASSISTANT',
                text: '',
                createdAt: new Date().toISOString(),
                error: errorText(error),
              },
            ])
          },
        }
      )
    },
    [context, contextKey, conversationId, mutation, onAnswer]
  )

  const reset = useCallback(() => {
    requestVersion.current += 1
    sending.current = false
    setMessages([])
    setConversationId(null)
    setIsRestored(false)
  }, [])

  const startNewChat = useCallback(() => {
    requestVersion.current += 1
    sending.current = false
    setMessages([])
    setConversationId(null)
    // Explicitly empty: do not restore the previous conversation from cache.
    setIsRestored(true)
  }, [])

  /**
   * Подставляет переписку, сохранённую на сервере.
   *
   * Только в пустую ленту: восстановление не должно затирать вопрос, который человек
   * успел задать, пока история подгружалась.
   */
  const restore = useCallback(
    (restoredId: number | null, restored: AssistantChatMessage[]) => {
      setIsRestored(true)
      setMessages((current) => (current.length === 0 ? restored : current))
      setConversationId((current) => current ?? restoredId)
    },
    []
  )

  const prepend = useCallback((older: AssistantChatMessage[]) => {
    setMessages((current) => {
      const ids = new Set(current.map((message) => message.id))
      const missing = older.filter((message) => !ids.has(message.id))
      return missing.length > 0 ? [...missing, ...current] : current
    })
  }, [])

  return {
    messages,
    conversationId,
    prepend,
    isPending: mutation.isPending,
    isEmpty: messages.length === 0,
    isRestored,
    send,
    restore,
    reset,
    startNewChat,
  }
}
