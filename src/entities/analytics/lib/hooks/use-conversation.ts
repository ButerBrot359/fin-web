import { useQuery } from '@tanstack/react-query'

import { analyticsApi } from '../../api/analytics-api'
import { analyticsKeys } from '../query-keys'
import type {
  AnalyticsConversation,
  AnalyticsLlmRequest,
} from '../../types/assistant'

/**
 * История диалога с ассистентом — нужна при возврате к сохранённому объекту
 * или после перезагрузки страницы. Свежие сообщения кладёт в состояние сама
 * мутация генерации, поэтому фоновые перезапросы здесь только мешали бы.
 */
export const useConversation = (
  id: number | undefined
): { conversation: AnalyticsConversation | null; isLoading: boolean } => {
  const { data, isLoading } = useQuery({
    queryKey: analyticsKeys.conversation(id ?? 0),
    queryFn: ({ signal }) => analyticsApi.getConversation(id!, signal),
    enabled: id != null,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  return { conversation: data ?? null, isLoading }
}

/**
 * Запись аудита обращения к модели: ровно то, что было отправлено.
 *
 * Это доказательство обещания «в ИИ уходит только структура данных», поэтому
 * загружаем по требованию — когда пользователь открыл панель «Что ушло в ИИ»
 * (`enabled`), а не вместе с ответом ассистента.
 */
export const useLlmRequest = (
  id: number | undefined,
  enabled: boolean
): { request: AnalyticsLlmRequest | null; isLoading: boolean } => {
  const { data, isLoading } = useQuery({
    queryKey: analyticsKeys.llmRequest(id ?? 0),
    queryFn: ({ signal }) => analyticsApi.getLlmRequest(id!, signal),
    enabled: enabled && id != null,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  return { request: data ?? null, isLoading }
}
