import { useCallback, useState } from 'react'

import {
  useAskAssistant,
  type AiAssistantAnswer,
  type AiAssistantContext,
} from '@/entities/ai-assistant'

import { useDesignRefresh } from './use-design-refresh'

/** Реплика в ленте диалога. */
export interface AssistantChatMessage {
  id: string
  role: 'USER' | 'ASSISTANT'
  text: string
  answer?: AiAssistantAnswer
  error?: string
}

interface AssistantSession {
  messages: AssistantChatMessage[]
  isPending: boolean
  /** Лента пуста — можно подставить переписку с сервера, ничего не затерев. */
  isEmpty: boolean
  send: (question: string) => void
  restore: (conversationId: number, messages: AssistantChatMessage[]) => void
  reset: () => void
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

/**
 * Диалог с помощником в пределах открытой панели.
 *
 * Состояние локальное и не переживает перезагрузку страницы — на сервере диалог
 * при этом сохраняется, и это намеренная асимметрия: серверная запись нужна для
 * журнала обращений, а показывать бухгалтеру вчерашнюю переписку по документу,
 * который он уже закрыл, незачем.
 *
 * `conversationId` сервер возвращает сам и сам же заводит новый диалог при смене
 * документа — критерий приёмки требует не смешивать данные разных объектов,
 * и решать это на клиенте было бы ненадёжно.
 */
export const useAssistantSession = (
  context: AiAssistantContext
): AssistantSession => {
  const [messages, setMessages] = useState<AssistantChatMessage[]>([])
  const [conversationId, setConversationId] = useState<number | null>(null)
  const mutation = useAskAssistant()
  const refreshDesign = useDesignRefresh()

  const send = useCallback(
    (question: string) => {
      const trimmed = question.trim()
      if (!trimmed || mutation.isPending) return

      setMessages((current) => [
        ...current,
        { id: nextId(), role: 'USER', text: trimmed },
      ])

      mutation.mutate(
        { conversationId, question: trimmed, context },
        {
          onSuccess: (answer) => {
            refreshDesign(answer)
            setConversationId(answer.conversationId)
            setMessages((current) => [
              ...current,
              {
                id: nextId(),
                role: 'ASSISTANT',
                text: answer.conclusion,
                answer,
              },
            ])
          },
          onError: (error) => {
            setMessages((current) => [
              ...current,
              {
                id: nextId(),
                role: 'ASSISTANT',
                text: '',
                error: errorText(error),
              },
            ])
          },
        }
      )
    },
    [context, conversationId, mutation, refreshDesign]
  )

  const reset = useCallback(() => {
    setMessages([])
    setConversationId(null)
  }, [])

  /**
   * Подставляет переписку, сохранённую на сервере.
   *
   * Только в пустую ленту: восстановление не должно затирать вопрос, который человек
   * успел задать, пока история подгружалась.
   */
  const restore = useCallback(
    (restoredId: number, restored: AssistantChatMessage[]) => {
      setMessages((current) => (current.length === 0 ? restored : current))
      setConversationId((current) => current ?? restoredId)
    },
    []
  )

  return {
    messages,
    isPending: mutation.isPending,
    isEmpty: messages.length === 0,
    send,
    restore,
    reset,
  }
}
