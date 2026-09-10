import { useState } from 'react'
import {
  useAiConversationMessages,
  useAiConversations,
  type AiAssistantAnswer,
  type AiAssistantContext,
  type AiConversationMessage,
} from '@/entities/ai-assistant'

import {
  useAssistantSession,
  type AssistantChatMessage,
} from './use-assistant-session'

export const restoreChatMessages = (
  messages: AiConversationMessage[]
): AssistantChatMessage[] =>
  messages
    .filter((message) => message.role !== 'TOOL')
    .map((message) => {
      const saved = message.role === 'ASSISTANT' ? message.answer : null
      // Старые JSON-ответы могли содержать только conclusion. Они тоже читаются.
      const answer: AiAssistantAnswer | undefined = saved
        ? {
            conversationId: saved.conversationId ?? 0,
            conclusion: saved.conclusion ?? message.content,
            breakdown: Array.isArray(saved.breakdown) ? saved.breakdown : [],
            sources: Array.isArray(saved.sources) ? saved.sources : [],
            actions: Array.isArray(saved.actions) ? saved.actions : [],
            created: Array.isArray(saved.created) ? saved.created : [],
            missing: saved.missing,
            latencyMs: saved.latencyMs ?? 0,
            requestLogId: saved.requestLogId,
          }
        : undefined
      return {
        id: `stored-${String(message.id)}`,
        role: message.role === 'USER' ? 'USER' : 'ASSISTANT',
        text: answer?.conclusion ?? message.content,
        createdAt: message.createdAt,
        answer,
        error:
          message.role === 'ASSISTANT'
            ? (message.error ?? undefined)
            : undefined,
      }
    })

/** Не начинаем новый серверный диалог, пока не прочитали существующий. */
export const useRestoredAssistantSession = (
  context: AiAssistantContext,
  enabled: boolean,
  onAnswer?: (answer: AiAssistantAnswer) => void
) => {
  const session = useAssistantSession(context, onAnswer)
  const history = useAiConversations(context, enabled && !session.isRestored)
  const restoredId = context.typeCode
    ? history.conversations.length > 0
      ? history.conversations[0].id
      : null
    : (history.conversations.find(
        (conversation) =>
          conversation.contextType == null && conversation.contextId == null
      )?.id ?? null)
  const messageConversationId = session.isRestored
    ? session.conversationId
    : restoredId
  const stored = useAiConversationMessages(
    messageConversationId,
    enabled && !session.isRestored
  )
  const [mergedPage, setMergedPage] = useState('')
  const pageKey = `${String(messageConversationId)}:${String(stored.pageCount)}`
  if (session.isRestored && stored.pageCount > 1 && mergedPage !== pageKey) {
    setMergedPage(pageKey)
    session.prepend(restoreChatMessages(stored.olderMessages))
  }

  if (
    enabled &&
    !session.isRestored &&
    history.isSuccess &&
    !history.isFetching &&
    (restoredId == null || (stored.isSuccess && !stored.isFetching))
  ) {
    session.restore(
      restoredId,
      restoreChatMessages(restoredId == null ? [] : stored.messages)
    )
  }

  const historyError =
    !session.isRestored &&
    (history.isError || (restoredId != null && stored.isError))
  const historyLoading = enabled && !session.isRestored && !historyError

  return {
    ...session,
    historyLoading,
    historyError,
    hasOlderMessages: session.isRestored && stored.hasOlderMessages,
    isLoadingOlder: stored.isLoadingOlder,
    olderMessagesError: stored.olderMessagesError,
    loadOlder: stored.loadOlder,
    retryHistory: () => {
      if (history.isError) history.retry()
      else stored.retry()
    },
    send: (question: string) => {
      if (enabled && session.isRestored) session.send(question)
    },
  }
}
