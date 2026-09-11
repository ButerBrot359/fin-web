import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import {
  useAssistantOwnerKey,
  readAssistantSession,
  writeAssistantSession,
} from '../session-persistence'

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
  ownerKey: string | null
  persisted: ReturnType<typeof readAssistantSession>
  needsRecovery: boolean
  recoveryError: (text: string) => void
  recover: (
    conversationId: number,
    finished: boolean,
    userMessageId?: number,
    userCreatedAt?: string
  ) => void
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
  const ownerKey = useAssistantOwnerKey()
  const [sessionOwner, setSessionOwner] = useState(ownerKey)
  const [persisted, setPersisted] = useState(() =>
    readAssistantSession(ownerKey)
  )
  const persist = useCallback(
    (value: NonNullable<typeof persisted>) => {
      writeAssistantSession(ownerKey, value)
      setPersisted(value)
    },
    [ownerKey]
  )
  const [isRestored, setIsRestored] = useState(
    () =>
      persisted?.explicitNew === true &&
      !persisted.pending &&
      persisted.conversationId == null
  )
  const [needsRecovery, setNeedsRecovery] = useState(!!persisted?.pending)
  const [messages, setMessages] = useState<AssistantChatMessage[]>(() =>
    persisted?.pending?.question
      ? [
          {
            id: `pending-${persisted.pending.requestId}`,
            role: 'USER',
            text: persisted.pending.question,
            createdAt:
              persisted.pending.createdAt ??
              new Date(persisted.pending.startedAt).toISOString(),
          },
        ]
      : []
  )
  const [conversationId, setConversationId] = useState<number | null>(
    () => persisted?.conversationId ?? null
  )
  const mutation = useAskAssistant()
  const contextKey = JSON.stringify([
    context.kind,
    context.typeCode,
    context.entryId,
  ])
  const activeOwner = useRef(ownerKey)
  const activeContext = useRef(contextKey)
  useLayoutEffect(() => {
    activeContext.current = contextKey
  }, [contextKey])
  const requestVersion = useRef(0)
  const sending = useRef(false)
  const pendingRequest = useRef<{
    payload: string
    id: string
    userMessageId: string
  } | null>(null)
  useLayoutEffect(() => {
    activeOwner.current = ownerKey
    requestVersion.current += 1
    sending.current = false
    pendingRequest.current = null
  }, [ownerKey])
  if (sessionOwner !== ownerKey) {
    const stored = readAssistantSession(ownerKey)
    setSessionOwner(ownerKey)
    setPersisted(stored)
    setNeedsRecovery(!!stored?.pending)
    setMessages(
      stored?.pending?.question
        ? [
            {
              id: `pending-${stored.pending.requestId}`,
              role: 'USER',
              text: stored.pending.question,
              createdAt:
                stored.pending.createdAt ??
                new Date(stored.pending.startedAt).toISOString(),
            },
          ]
        : []
    )
    setConversationId(stored?.conversationId ?? null)
    setIsRestored(
      stored?.explicitNew === true &&
        !stored.pending &&
        stored.conversationId == null
    )
  }

  const send = useCallback(
    (question: string) => {
      const trimmed = question.trim()
      if (!trimmed || mutation.isPending || sending.current) return
      sending.current = true
      setNeedsRecovery(false)
      setIsRestored(true)
      const version = requestVersion.current
      const isCurrent = () =>
        activeOwner.current === ownerKey && requestVersion.current === version

      const payload = JSON.stringify({
        conversationId,
        question: trimmed,
        context,
      })
      if (pendingRequest.current?.payload !== payload) {
        pendingRequest.current = {
          payload,
          id: crypto.randomUUID(),
          userMessageId: nextId(),
        }
      }
      const userMessageId = pendingRequest.current.userMessageId
      const errorId = `request-error-${pendingRequest.current.id}`
      const userCreatedAt = new Date().toISOString()
      setMessages((current) => {
        const withoutError = current.filter((message) => message.id !== errorId)
        return withoutError.some((message) => message.id === userMessageId)
          ? withoutError
          : [
              ...withoutError,
              {
                id: userMessageId,
                role: 'USER',
                text: trimmed,
                createdAt: userCreatedAt,
              },
            ]
      })
      persist({
        conversationId,
        explicitNew: false,
        pending: {
          requestId: pendingRequest.current.id,
          startedAt: Date.now(),
          question: trimmed,
          createdAt: userCreatedAt,
        },
      })
      mutation.mutate(
        {
          conversationId,
          question: trimmed,
          context,
          requestId: pendingRequest.current.id,
        },
        {
          onSuccess: (answer) => {
            if (!isCurrent()) return
            sending.current = false
            setNeedsRecovery(false)
            pendingRequest.current = null
            persist({
              conversationId: answer.conversationId,
              explicitNew: false,
            })
            setConversationId(answer.conversationId)
            setMessages((current) => [
              ...current
                .filter((message) => message.id !== errorId)
                .map((message) =>
                  message.id === userMessageId
                    ? {
                        ...message,
                        id: answer.userMessageId
                          ? `stored-${String(answer.userMessageId)}`
                          : message.id,
                        createdAt: answer.userCreatedAt ?? message.createdAt,
                      }
                    : message
                ),
              {
                id: answer.assistantMessageId
                  ? `stored-${String(answer.assistantMessageId)}`
                  : nextId(),
                role: 'ASSISTANT',
                createdAt: answer.createdAt ?? new Date().toISOString(),
                text: answer.conclusion,
                answer,
              },
            ])
            if (activeContext.current === contextKey) onAnswer?.(answer)
          },
          onError: (error) => {
            if (!isCurrent()) return
            sending.current = false
            setNeedsRecovery(true)
            setMessages((current) => [
              ...current.filter((message) => message.id !== errorId),
              {
                id: errorId,
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
    [context, contextKey, conversationId, mutation, onAnswer, ownerKey, persist]
  )

  const reset = useCallback(() => {
    requestVersion.current += 1
    sending.current = false
    pendingRequest.current = null
    setMessages([])
    setNeedsRecovery(false)
    setConversationId(null)
    setIsRestored(false)
    persist({ conversationId: null, explicitNew: false })
  }, [persist])

  const startNewChat = useCallback(() => {
    requestVersion.current += 1
    sending.current = false
    pendingRequest.current = null
    setMessages([])
    setNeedsRecovery(false)
    setConversationId(null)
    // Explicitly empty: do not restore the previous conversation from cache.
    setIsRestored(true)
    persist({ conversationId: null, explicitNew: true })
  }, [persist])

  /**
   * Подставляет переписку, сохранённую на сервере.
   *
   * Только в пустую ленту: восстановление не должно затирать вопрос, который человек
   * успел задать, пока история подгружалась.
   */
  const restore = useCallback(
    (restoredId: number | null, restored: AssistantChatMessage[]) => {
      setIsRestored(true)
      persist({ ...persisted, conversationId: restoredId, explicitNew: false })
      setMessages((current) => (current.length === 0 ? restored : current))
      setConversationId((current) => current ?? restoredId)
    },
    [persist, persisted]
  )

  const prepend = useCallback((incoming: AssistantChatMessage[]) => {
    setMessages((current) => {
      const merged = new Map(current.map((message) => [message.id, message]))
      incoming.forEach((message) => merged.set(message.id, message))
      return [...merged.values()].sort((a, b) => {
        const aId = a.id.startsWith('stored-') ? Number(a.id.slice(7)) : null
        const bId = b.id.startsWith('stored-') ? Number(b.id.slice(7)) : null
        if (aId != null && bId != null) return aId - bId
        if (aId != null) return -1
        if (bId != null) return 1
        return 0
      })
    })
  }, [])
  const recover = useCallback(
    (
      id: number,
      finished: boolean,
      userId?: number,
      userCreatedAt?: string
    ) => {
      setConversationId(id)
      const pending = persisted?.pending
      if (userId && pending) {
        setMessages((current) => {
          const merged = current
            .map((message) =>
              message.id === `pending-${pending.requestId}` ||
              message.id === pendingRequest.current?.userMessageId
                ? {
                    ...message,
                    id: `stored-${String(userId)}`,
                    createdAt: userCreatedAt ?? message.createdAt,
                  }
                : message
            )
            .filter(
              (message) =>
                !finished || message.id !== `request-error-${pending.requestId}`
            )
          return [
            ...new Map(merged.map((message) => [message.id, message])).values(),
          ]
        })
      }
      if (finished) setNeedsRecovery(false)
      // Once server registration is acknowledged, the one temporary question is no longer needed.
      persist({
        conversationId: id,
        explicitNew: false,
        ...(!finished && pending
          ? {
              pending: {
                requestId: pending.requestId,
                startedAt: pending.startedAt,
              },
            }
          : {}),
      })
    },
    [persist, persisted]
  )
  const recoveryError = useCallback(
    (text: string) => {
      const id = `request-error-${persisted?.pending?.requestId ?? 'unknown'}`
      setMessages((current) => [
        ...current.filter((message) => message.id !== id),
        {
          id,
          role: 'ASSISTANT',
          text: '',
          createdAt: new Date(
            persisted?.pending?.startedAt ?? Date.now()
          ).toISOString(),
          error: text,
        },
      ])
    },
    [persisted]
  )

  return {
    ownerKey,
    needsRecovery,
    recoveryError,
    persisted,
    recover,
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
