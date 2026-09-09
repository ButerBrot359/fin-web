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

const unwrap = <T>(response: ApiResponse<T>): T => response.data

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

  getDisclosure: (signal?: AbortSignal): Promise<AiDisclosure[]> =>
    apiService
      .get<ApiResponse<AiDisclosure[]>>({
        url: `${BASE_URL}/disclosure`,
        signal,
      })
      .then(unwrap),
}
