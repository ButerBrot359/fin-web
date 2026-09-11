import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { useGenerateSpec } from '@/entities/analytics'
import { analyticsApi } from '@/entities/analytics/api/analytics-api'
import type { AnalyticsItemKind, AnalyticsSpec } from '@/entities/analytics'
import type {
  AnalyticsAssistantStatus,
  AnalyticsClarificationQuestion,
} from '@/entities/analytics/types/assistant'
import { useAuthStore } from '@/features/auth/lib/hooks/use-auth-store'
import { extractErrorText } from '../utils/assistant-error'
import { useAnalyticsWorkspaceCopy } from '../workspace-copy'

export interface AssistantChatMessage {
  id: string
  role: 'USER' | 'ASSISTANT'
  text: string
  createdAt?: string
  spec?: AnalyticsSpec | null
  llmRequestId?: number | null
  sourceViews?: string[]
  warnings?: string[]
  error?: string | null
  status?: AnalyticsAssistantStatus
  questions?: AnalyticsClarificationQuestion[]
  suggestions?: string[]
}
const readId = (key: string | null): number | null => {
  if (!key) return null
  try {
    const value = Number(sessionStorage.getItem(key))
    return Number.isSafeInteger(value) && value > 0 ? value : null
  } catch {
    return null
  }
}
const storeId = (key: string | null, id: number | null) => {
  if (!key) return
  try {
    if (id == null) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, String(id))
  } catch {
    /* History is still held on the server. */
  }
}

/** The mode and authenticated account own the conversation, independently of the page context. */
export const useAssistantSession = (kind: AnalyticsItemKind = 'DASHBOARD') => {
  const ownerId = useAuthStore((state) => state.user?.id)
  const ownerKey =
    ownerId == null
      ? null
      : `analytics-assistant-v1:${window.location.origin}:${String(ownerId)}:${kind}`
  const copy = useAnalyticsWorkspaceCopy(kind)
  const restoreCopy = useRef(copy)
  useLayoutEffect(() => {
    restoreCopy.current = copy
  }, [copy])
  const [messages, setMessages] = useState<AssistantChatMessage[]>([])
  const [currentSpec, setCurrentSpec] = useState<AnalyticsSpec | null>(null)
  const [conversationId, setConversationId] = useState<number | null>(null)
  const [isRestoring, setIsRestoring] = useState(!!readId(ownerKey))
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [restoreAttempt, setRestoreAttempt] = useState(0)
  const resetKey = JSON.stringify([ownerKey, restoreAttempt])
  const [renderedKey, setRenderedKey] = useState(resetKey)
  if (renderedKey !== resetKey) {
    setRenderedKey(resetKey)
    setMessages([])
    setCurrentSpec(null)
    setConversationId(null)
    setRestoreError(null)
    setIsRestoring(readId(ownerKey) != null)
  }
  const epoch = useRef(0)
  const sending = useRef(false)
  const scope = useRef(ownerKey)
  const { mutate, isPending } = useGenerateSpec()
  useLayoutEffect(() => {
    scope.current = ownerKey
    epoch.current += 1
    sending.current = false
  }, [ownerKey])
  useEffect(() => {
    const version = ++epoch.current
    const controller = new AbortController()
    const id = readId(ownerKey)
    if (id != null) {
      void analyticsApi
        .getConversation(id, controller.signal)
        .then((conversation) => {
          if (epoch.current !== version || scope.current !== ownerKey) return
          if (conversation.kind !== kind) {
            storeId(ownerKey, null)
            setRestoreError(restoreCopy.current.wrongKind)
            return
          }
          setConversationId(id)
          setMessages(
            conversation.messages.map((message) => ({
              id: `stored-${String(message.id)}`,
              role: message.role,
              text: message.content ?? '',
              createdAt: message.createdAt,
              spec: message.spec,
              error: message.errorMessage,
              llmRequestId: message.llmRequestId,
              sourceViews: message.spec?.sourceViews ?? [],
              status: message.status,
              questions: message.questions,
              suggestions: message.suggestions,
            }))
          )
          const latest = [...conversation.messages]
            .reverse()
            .find(
              (message) =>
                message.spec?.kind === kind &&
                !message.errorMessage &&
                message.status !== 'FAILED' &&
                message.status !== 'CLARIFICATION'
            )
          setCurrentSpec(latest?.spec ?? null)
        })
        .catch((error: unknown) => {
          if (epoch.current === version && !controller.signal.aborted)
            setRestoreError(
              extractErrorText(error) ?? restoreCopy.current.restoreError
            )
        })
        .finally(() => {
          if (epoch.current === version) setIsRestoring(false)
        })
    }
    return () => {
      controller.abort()
      epoch.current += 1
    }
  }, [ownerKey, kind, restoreAttempt])

  const send = useCallback(
    (prompt: string) => {
      const text = prompt.trim()
      if (!text || isPending || sending.current || isRestoring || restoreError)
        return
      sending.current = true
      const version = epoch.current
      const id = crypto.randomUUID()
      setMessages((previous) => [
        ...previous,
        { id, role: 'USER', text, createdAt: new Date().toISOString() },
      ])
      mutate(
        { prompt: text, kind, conversationId, currentSpec },
        {
          onSuccess: (response) => {
            if (epoch.current !== version || scope.current !== ownerKey) return
            sending.current = false
            storeId(ownerKey, response.conversationId)
            setConversationId(response.conversationId)
            const wrongKind =
              response.spec != null && response.spec.kind !== kind
            if (
              response.spec &&
              !response.error &&
              !wrongKind &&
              response.status !== 'FAILED' &&
              response.status !== 'CLARIFICATION'
            )
              setCurrentSpec(response.spec)
            setMessages((previous) => [
              ...previous.map((message) =>
                message.id === id
                  ? {
                      ...message,
                      id: response.userMessageId
                        ? `stored-${String(response.userMessageId)}`
                        : message.id,
                      createdAt: response.userCreatedAt ?? message.createdAt,
                    }
                  : message
              ),
              {
                id: `stored-${String(response.messageId)}`,
                role: 'ASSISTANT',
                text: response.explanation ?? '',
                createdAt: response.createdAt ?? new Date().toISOString(),
                spec: wrongKind ? null : response.spec,
                llmRequestId:
                  response.llmRequestIds?.at(-1) ?? response.llmRequestId,
                sourceViews: response.spec?.sourceViews,
                warnings: response.warnings,
                error: wrongKind ? copy.wrongKind : response.error,
                status: response.status,
                questions: response.questions,
                suggestions: response.suggestions,
              },
            ])
          },
          onError: (error) => {
            if (epoch.current !== version || scope.current !== ownerKey) return
            sending.current = false
            setMessages((previous) => [
              ...previous,
              {
                id: crypto.randomUUID(),
                role: 'ASSISTANT',
                text: '',
                error: extractErrorText(error),
                createdAt: new Date().toISOString(),
                status: 'FAILED',
              },
            ])
          },
        }
      )
    },
    [
      conversationId,
      currentSpec,
      kind,
      isPending,
      isRestoring,
      restoreError,
      mutate,
      ownerKey,
      copy.wrongKind,
    ]
  )
  const reset = useCallback(() => {
    epoch.current += 1
    sending.current = false
    storeId(ownerKey, null)
    setMessages([])
    setCurrentSpec(null)
    setConversationId(null)
    setRestoreError(null)
    setIsRestoring(false)
  }, [ownerKey])
  return {
    messages,
    currentSpec,
    conversationId,
    kind,
    isPending,
    isRestoring,
    restoreError,
    send,
    reset,
    retryRestore: () => {
      setRestoreAttempt((value) => value + 1)
    },
  }
}

export type AssistantSession = ReturnType<typeof useAssistantSession>
