import { apiService } from '@/shared/api/api'
import type { ApiResponse } from '@/shared/types/api.types'

import type {
  AiAssistantAnswer,
  AiAssistantChatRequest,
  AiAssistantConfirmAction,
  AiAssistantCreatedDocument,
  AiAssistantSettings,
  AiAssistantSettingsUpdate,
  AiDisclosure,
} from '../types/ai-assistant'
import type {
  AiConversation,
  AiConversationPage,
  AiConversationMessagePage,
} from '../types/conversation'

const BASE_URL = '/api/ai-assistant'

/**
 * Потолок ожидания вызова, который ждёт модель.
 *
 * Тот же, что у ассистента аналитики, и по той же причине: долгие пути вынесены
 * в отдельный Ingress с потолком 900 с, и клиент не должен сдаваться раньше
 * шлюза — иначе пользователь увидит «превышено время ожидания» вместо настоящей
 * причины. Своя модель на пользовательском железе отвечает минутами.
 */
const LLM_CALL_TIMEOUT_MS = 930_000

/**
 * Разворачивает двойную обёртку: axios отдаёт `AxiosResponse`, внутри которого
 * лежит `ApiDataResponse` бэкенда. Отсюда `res.data.data` — уровня здесь два,
 * и пропуск одного из них возвращает наружу конверт вместо самих данных.
 */
const unwrap = <T>(res: { data: ApiResponse<T> }): T => res.data.data

export const aiAssistantApi = {
  ask: (
    request: AiAssistantChatRequest,
    signal?: AbortSignal
  ): Promise<AiAssistantAnswer> =>
    apiService
      .post<ApiResponse<AiAssistantAnswer>>({
        url: `${BASE_URL}/ask`,
        data: request,
        signal,
        timeout: LLM_CALL_TIMEOUT_MS,
      })
      .then(unwrap),

  /**
   * Подтверждение изменяющего действия.
   *
   * Отдельный вызов, а не флаг в запросе чата: пока действие лежит в ответе
   * модели, оно остаётся текстом. Выполняет его запрос, который начал человек.
   */
  confirmAction: (
    request: AiAssistantConfirmAction,
    signal?: AbortSignal
  ): Promise<AiAssistantCreatedDocument> =>
    apiService
      .post<ApiResponse<AiAssistantCreatedDocument>>({
        url: `${BASE_URL}/actions/confirm`,
        data: request,
        signal,
      })
      .then(unwrap),

  getSettings: (signal?: AbortSignal): Promise<AiAssistantSettings> =>
    apiService
      .get<ApiResponse<AiAssistantSettings>>({
        url: `${BASE_URL}/settings`,
        signal,
      })
      .then(unwrap),

  updateSettings: (
    request: AiAssistantSettingsUpdate,
    signal?: AbortSignal
  ): Promise<AiAssistantSettings> =>
    apiService
      .put<ApiResponse<AiAssistantSettings>>({
        url: `${BASE_URL}/settings`,
        data: request,
        signal,
      })
      .then(unwrap),

  /** Диалоги пользователя; с контекстом — только по этому объекту. */
  getConversations: (
    context?: { typeCode?: string | null; entryId?: number | null },
    signal?: AbortSignal
  ): Promise<AiConversation[]> =>
    apiService
      .get<ApiResponse<AiConversation[]>>({
        url: `${BASE_URL}/conversations`,
        params: context?.typeCode
          ? { contextType: context.typeCode, contextId: context.entryId }
          : undefined,
        signal,
      })
      .then(unwrap),

  getConversationPage: (
    beforeId: number | null,
    signal?: AbortSignal
  ): Promise<AiConversationPage> =>
    apiService
      .get<ApiResponse<AiConversationPage>>({
        url: `${BASE_URL}/conversations/page`,
        params: { limit: 10, ...(beforeId != null ? { beforeId } : {}) },
        signal,
      })
      .then(unwrap),

  getConversationMessages: (
    id: number,
    signal?: AbortSignal,
    beforeId?: number | null
  ): Promise<AiConversationMessagePage> =>
    apiService
      .get<ApiResponse<AiConversationMessagePage>>({
        url: `${BASE_URL}/conversations/${String(id)}/messages`,
        params: { limit: 10, ...(beforeId != null ? { beforeId } : {}) },
        signal,
      })
      .then(unwrap),

  getDisclosure: (signal?: AbortSignal): Promise<AiDisclosure[]> =>
    apiService
      .get<ApiResponse<AiDisclosure[]>>({
        url: `${BASE_URL}/disclosure`,
        signal,
      })
      .then(unwrap),
}
