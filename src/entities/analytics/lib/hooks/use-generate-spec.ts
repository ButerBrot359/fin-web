import { useMutation, type UseMutationResult } from '@tanstack/react-query'

import { analyticsApi } from '../../api/analytics-api'
import type {
  AnalyticsGenerateRequest,
  AnalyticsGenerateResponse,
} from '../../types/assistant'

/**
 * Построение спецификации ассистентом.
 *
 * Мутация, а не запрос: результат зависит от формулировки и от истории диалога,
 * кэшировать и автоматически повторять его нельзя — каждый вызов стоит денег и
 * может дать другой ответ.
 *
 * В модель уходит только структура данных (витрины, колонки, типы); строки
 * результата в промпт не попадают — этим распоряжается бэкенд, фронт передаёт
 * лишь формулировку и текущую спецификацию.
 *
 * Ответ с `error` — это НЕ отказ мутации: бэкенд отвечает 200 и кладёт причину
 * в поле, чтобы вместе с ней вернуть `llmRequestId` для панели «Что ушло в ИИ».
 * Проверять `response.error` обязательно.
 */
export const useGenerateSpec = (): UseMutationResult<
  AnalyticsGenerateResponse,
  unknown,
  AnalyticsGenerateRequest
> =>
  useMutation({
    mutationFn: (request: AnalyticsGenerateRequest) =>
      analyticsApi.generate(request),
  })
