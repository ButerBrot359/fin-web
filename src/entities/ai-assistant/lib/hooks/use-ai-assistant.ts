import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { requestOpenViewsRefresh } from '@/shared/lib/refresh/open-views-refresh'
import { showToast } from '@/shared/ui/toast/show-toast'

import {
  useMutation,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'

import {
  invalidateDictionaryQueries,
  invalidateDocumentQueries,
} from '@/shared/lib/query/invalidate-entities'

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
import type { AiConversation } from '../../types/conversation'
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
> => {
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  return useMutation({
    mutationFn: (request: AiAssistantChatRequest) =>
      aiAssistantApi.ask(request),
    // Ответ может содержать несколько мутаций, включая справочники и пометку
    // удаления без created. Даже при потере ответа часть действий могла завершиться.
    onSettled: async (answer) => {
      void queryClient.invalidateQueries({
        queryKey: ['ai-assistant', 'conversation'],
      })
      invalidateDocumentQueries(queryClient)
      invalidateDictionaryQueries(queryClient)
      for (const key of [
        'sdui-list',
        'document-movements',
        'sdui-report-result',
      ]) {
        void queryClient.invalidateQueries({ queryKey: [key] })
      }
      void queryClient.invalidateQueries({
        queryKey: aiAssistantKeys.conversations(),
      })
      const hasChanges =
        answer == null ||
        answer.created.length > 0 ||
        answer.actions.some(
          (action) =>
            !action.error &&
            [
              'DELETE_DOCUMENT',
              'CREATE_DICTIONARY_ENTRY',
              'UPDATE_DICTIONARY_ENTRY',
            ].includes(action.kind)
        )
      if (hasChanges) {
        const refreshed = await requestOpenViewsRefresh()
        if (refreshed.deferred > 0)
          showToast('warning', t('aiAssistant.refreshDeferred'))
        if (refreshed.failed > 0)
          showToast('error', t('aiAssistant.refreshFailed'))
      }
    },
  })
}

/** Подтверждение действия: создаёт документ НЕ проведённым. */
export const useConfirmAssistantAction = (): UseMutationResult<
  AiAssistantCreatedDocument,
  unknown,
  AiAssistantConfirmAction
> => {
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  return useMutation({
    mutationFn: (request: AiAssistantConfirmAction) =>
      aiAssistantApi.confirmAction(request),
    onSettled: async () => {
      invalidateDocumentQueries(queryClient)
      void queryClient.invalidateQueries({ queryKey: ['sdui-list'] })
      const refreshed = await requestOpenViewsRefresh()
      if (refreshed.deferred > 0)
        showToast('warning', t('aiAssistant.refreshDeferred'))
      if (refreshed.failed > 0)
        showToast('error', t('aiAssistant.refreshFailed'))
    },
  })
}

/**
 * Настройки помощника.
 *
 * @param enabled панель помощника смонтирована на каждой странице приложения, а
 *        разрешения ей нужны только открытой — чтобы не показывать заготовку,
 *        которую сервер всё равно отклонит. Форма настроек зовёт без аргумента.
 */
export const useAiAssistantSettings = (
  enabled = true
): {
  settings: AiAssistantSettings | null
  isLoading: boolean
} => {
  const { data, isLoading } = useQuery({
    queryKey: aiAssistantKeys.settings(),
    queryFn: ({ signal }) => aiAssistantApi.getSettings(signal),
    enabled,
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
): {
  conversations: AiConversation[]
  isLoading: boolean
  isSuccess: boolean
  isFetching: boolean
  isError: boolean
  retry: () => void
} => {
  const { data, isLoading, isSuccess, isFetching, isError, refetch } = useQuery(
    {
      queryKey: [
        ...aiAssistantKeys.conversations(),
        context?.typeCode ?? '',
        context?.entryId ?? '',
      ],
      queryFn: ({ signal }) => aiAssistantApi.getConversations(context, signal),
      enabled,
    }
  )
  return {
    conversations: data ?? [],
    isLoading,
    isSuccess,
    isFetching,
    isError,
    retry: () => {
      void refetch()
    },
  }
}

export const useAiConversationMessages = (
  conversationId: number | null,
  enabled = true
) => {
  const query = useInfiniteQuery({
    queryKey: [
      ...aiAssistantKeys.conversationMessages(conversationId ?? 0),
      'pages',
      10,
    ],
    initialPageParam: null as number | null,
    queryFn: ({ signal, pageParam }) =>
      aiAssistantApi.getConversationMessages(
        conversationId ?? 0,
        signal,
        pageParam
      ),
    getNextPageParam: (page) => (page.hasMore ? page.nextBeforeId : undefined),
    enabled: enabled && conversationId != null,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })
  const messages = useMemo(
    () =>
      query.data?.pages
        .slice()
        .reverse()
        .flatMap((page) => page.messages) ?? [],
    [query.data]
  )
  const olderMessages = useMemo(
    () =>
      query.data?.pages
        .slice(1)
        .reverse()
        .flatMap((page) => page.messages) ?? [],
    [query.data]
  )
  return {
    messages,
    olderMessages,
    pageCount: query.data?.pages.length ?? 0,
    isLoading: query.isLoading,
    isSuccess: query.isSuccess,
    isFetching: query.isFetching,
    isError: query.isError,
    hasOlderMessages: query.hasNextPage,
    isLoadingOlder: query.isFetchingNextPage,
    olderMessagesError: query.isFetchNextPageError,
    loadOlder: () => {
      if (query.hasNextPage && !query.isFetching)
        void query.fetchNextPage({ cancelRefetch: false })
    },
    retry: () => {
      void query.refetch()
    },
  }
}
