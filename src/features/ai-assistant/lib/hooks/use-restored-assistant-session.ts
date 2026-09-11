import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { aiAssistantApi } from '@/entities/ai-assistant/api/ai-assistant-api'
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
            ...saved,
            conversationId: saved.conversationId ?? 0,
            conclusion: saved.conclusion ?? message.content,
            breakdown: Array.isArray(saved.breakdown) ? saved.breakdown : [],
            sources: Array.isArray(saved.sources) ? saved.sources : [],
            actions: Array.isArray(saved.actions) ? saved.actions : [],
            created: Array.isArray(saved.created) ? saved.created : [],
            missing: saved.missing,
            latencyMs: saved.latencyMs ?? 0,
            requestLogId: saved.requestLogId,
            ...(saved.execution ? { execution: saved.execution } : {}),
            ...(saved.status ? { status: saved.status } : {}),
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
  const { t } = useTranslation()
  const session = useAssistantSession(context, onAnswer)
  const requestId = session.needsRecovery
    ? session.persisted?.pending?.requestId
    : undefined
  const [recovering, setRecovering] = useState(!!requestId)
  const [recoveryError, setRecoveryError] = useState(false)
  const [recoveryAttempt, setRecoveryAttempt] = useState(0)
  const retryStored = useRef<
    { id: number | null; retry: () => void } | undefined
  >(undefined)
  const sessionError = useRef(session.recoveryError)
  sessionError.current = session.recoveryError
  const recoveryCallback = useRef(session.recover)
  recoveryCallback.current = session.recover
  useEffect(() => {
    if (!requestId || !enabled) {
      setRecovering(false)
      return
    }
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const controller = new AbortController()
    const started = Date.now()
    setRecoveryError(false)
    setRecovering(true)
    const poll = async () => {
      try {
        const response = await aiAssistantApi.getRequest(
          requestId,
          controller.signal
        )
        if (cancelled) return
        const finished = response.status !== 'RUNNING'
        if (
          response.conversationId != null &&
          response.conversationId > 0 &&
          response.userMessageId != null &&
          response.userMessageId > 0
        )
          recoveryCallback.current(
            response.conversationId,
            finished && response.status !== 'INTERRUPTED',
            response.userMessageId,
            response.userCreatedAt
          )
        if (response.status === 'INTERRUPTED')
          sessionError.current(
            response.error ?? t('aiAssistant.requestInterrupted')
          )
        if (finished) {
          if (retryStored.current?.id === response.conversationId)
            retryStored.current.retry()
          setRecovering(false)
          return
        }
        if (Date.now() - started >= 930_000) throw new Error('Recovery timeout')
        timer = setTimeout(() => {
          void poll()
        }, 2000)
      } catch {
        if (cancelled) return
        // A reload may reach the lookup before the original request commits its registration.
        if (Date.now() - started < 10_000)
          timer = setTimeout(() => {
            void poll()
          }, 2000)
        else {
          setRecovering(false)
          setRecoveryError(true)
        }
      }
    }
    void poll()
    return () => {
      cancelled = true
      controller.abort()
      if (timer) clearTimeout(timer)
    }
  }, [enabled, session.ownerKey, requestId, recoveryAttempt, t])
  const explicitSession = session.persisted != null
  const history = useAiConversations(
    context,
    enabled && !session.isRestored && !explicitSession
  )
  const restoredId = explicitSession
    ? session.conversationId
    : context.typeCode
      ? (history.conversations[0]?.id ?? null)
      : (history.conversations.find(
          (conversation) =>
            conversation.contextType == null && conversation.contextId == null
        )?.id ?? null)
  const messageConversationId = session.isRestored
    ? session.conversationId
    : restoredId
  const stored = useAiConversationMessages(messageConversationId, enabled, true)
  retryStored.current = { id: messageConversationId, retry: stored.retry }
  const [mergedPage, setMergedPage] = useState('')
  const incoming = [...stored.messages, ...stored.olderMessages]
  const pageKey = `${String(messageConversationId)}:${JSON.stringify(incoming)}`
  if (
    messageConversationId != null &&
    session.isRestored &&
    !session.isPending &&
    !stored.isFetching &&
    stored.isSuccess &&
    mergedPage !== pageKey
  ) {
    setMergedPage(pageKey)
    session.prepend(restoreChatMessages(incoming))
  }

  if (
    enabled &&
    !session.isRestored &&
    !recoveryError &&
    (explicitSession || (history.isSuccess && !history.isFetching)) &&
    (restoredId == null || (stored.isSuccess && !stored.isFetching))
  ) {
    session.restore(
      restoredId,
      restoreChatMessages(restoredId == null ? [] : stored.messages)
    )
  }

  const historyError =
    recoveryError ||
    (!session.isRestored &&
      ((!explicitSession && history.isError) ||
        (restoredId != null && stored.isError)))
  const historyLoading = enabled && !session.isRestored && !historyError

  return {
    ...session,
    isPending: session.isPending || recovering,
    pendingStartedAt: session.persisted?.pending?.startedAt,
    historyLoading,
    historyError,
    hasOlderMessages: session.isRestored && stored.hasOlderMessages,
    isLoadingOlder: stored.isLoadingOlder,
    olderMessagesError: stored.olderMessagesError,
    loadOlder: stored.loadOlder,
    retryHistory: () => {
      if (recoveryError) {
        setRecoveryAttempt((value) => value + 1)
        return
      }
      if (history.isError) history.retry()
      else stored.retry()
    },
    send: (question: string) => {
      if (enabled && session.isRestored && !recovering && !recoveryError)
        session.send(question)
    },
  }
}
