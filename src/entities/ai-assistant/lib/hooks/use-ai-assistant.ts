import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'

import { aiAssistantApi } from '../../api/ai-assistant-api'
import type {
  AiAssistantAnswer,
  AiAssistantChatRequest,
  AiAssistantConfirmAction,
  AiAssistantCreatedDocument,
  AiAssistantSettings,
  AiAssistantSettingsUpdate,
  AiDisclosure,
} from '../../types/ai-assistant'
import type {
  AiConversation,
  AiConversationMessage,
} from '../../types/conversation'
import { aiAssistantKeys } from '../query-keys'

/**
 * Вопрос помощнику.
 *
 * Мутация, а не запрос: ответ зависит от формулировки и истории, повторять его
 * автоматически нельзя. Ответ приходит целиком — стриминга в этой версии нет.
 */
export const useAskAssistant = (): UseMutationResult<
  AiAssistantAnswer,
  unknown,
  AiAssistantChatRequest
> =>
  useMutation({
    mutationFn: (request: AiAssistantChatRequest) =>
      aiAssistantApi.ask(request),
  })

/** Подтверждение действия: создаёт документ НЕ проведённым. */
export const useConfirmAssistantAction = (): UseMutationResult<
  AiAssistantCreatedDocument,
  unknown,
  AiAssistantConfirmAction
> =>
  useMutation({
    mutationFn: (request: AiAssistantConfirmAction) =>
      aiAssistantApi.confirmAction(request),
  })

export const useAiAssistantSettings = (): {
  settings: AiAssistantSettings | null
  isLoading: boolean
} => {
  const { data, isLoading } = useQuery({
    queryKey: aiAssistantKeys.settings(),
    queryFn: ({ signal }) => aiAssistantApi.getSettings(signal),
  })
  return { settings: data ?? null, isLoading }
}

export const useUpdateAiAssistantSettings = (): UseMutationResult<
  AiAssistantSettings,
  unknown,
  AiAssistantSettingsUpdate
> => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: AiAssistantSettingsUpdate) =>
      aiAssistantApi.updateSettings(request),
    onSuccess: (saved) => {
      queryClient.setQueryData(aiAssistantKeys.settings(), saved)
      // Раскрытие зависит от провайдера: сменили его — предупреждение обязано
      // измениться немедленно, иначе экран показывает вчерашнюю правду.
      void queryClient.invalidateQueries({
        queryKey: aiAssistantKeys.disclosure(),
      })
    },
  })
}

/** Раскрытие «что уходит в ИИ» по обоим контурам сразу. */
export const useAiDisclosure = (): {
  disclosures: AiDisclosure[]
  isLoading: boolean
} => {
  const { data, isLoading } = useQuery({
    queryKey: aiAssistantKeys.disclosure(),
    queryFn: ({ signal }) => aiAssistantApi.getDisclosure(signal),
  })
  return { disclosures: data ?? [], isLoading }
}

/**
 * Диалоги по текущему объекту.
 *
 * Панель восстанавливает последний из них при открытии: разговор, исчезающий вместе с
 * окном, бесполезен — бухгалтер не станет заново описывать ситуацию ради второго вопроса.
 */
export const useAiConversations = (
  context?: { typeCode?: string | null; entryId?: number | null },
  enabled = true
): { conversations: AiConversation[]; isLoading: boolean } => {
  const { data, isLoading } = useQuery({
    queryKey: [
      ...aiAssistantKeys.conversations(),
      context?.typeCode ?? '',
      context?.entryId ?? '',
    ],
    queryFn: ({ signal }) => aiAssistantApi.getConversations(context, signal),
    enabled,
  })
  return { conversations: data ?? [], isLoading }
}

export const useAiConversationMessages = (
  conversationId: number | null
): { messages: AiConversationMessage[]; isLoading: boolean } => {
  const { data, isLoading } = useQuery({
    queryKey: aiAssistantKeys.conversationMessages(conversationId ?? 0),
    queryFn: ({ signal }) =>
      aiAssistantApi.getConversationMessages(conversationId ?? 0, signal),
    enabled: conversationId != null,
  })
  return { messages: data ?? [], isLoading }
}
