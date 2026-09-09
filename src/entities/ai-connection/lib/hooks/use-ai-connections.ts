import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'

import { aiAssistantKeys } from '@/entities/ai-assistant'
import { analyticsKeys } from '@/entities/analytics'

import { aiConnectionApi } from '../../api/ai-connection-api'
import type {
  AiConnection,
  AiConnectionTestResult,
  AiConnectionUpdate,
} from '../../types/ai-connection'

export const aiConnectionKeys = {
  root: ['ai-connections'] as const,
  list: () => ['ai-connections', 'list'] as const,
}

export const useAiConnections = (): {
  connections: AiConnection[]
  isLoading: boolean
} => {
  const { data, isLoading } = useQuery({
    queryKey: aiConnectionKeys.list(),
    queryFn: ({ signal }) => aiConnectionApi.list(signal),
  })
  return { connections: data ?? [], isLoading }
}

/**
 * Сброс кэша после правки подключения задевает и настройки контуров.
 *
 * Иначе экран показывает прежнюю модель у контура, который ссылается на только что
 * изменённое подключение, — и предупреждение «что уходит в ИИ» остаётся вчерашним,
 * хотя адресат данных уже другой.
 */
const useInvalidateAfterChange = (): (() => void) => {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: aiConnectionKeys.root })
    void queryClient.invalidateQueries({ queryKey: aiAssistantKeys.root })
    void queryClient.invalidateQueries({ queryKey: analyticsKeys.aiSettings() })
  }
}

export const useCreateAiConnection = (): UseMutationResult<
  AiConnection,
  unknown,
  AiConnectionUpdate
> => {
  const invalidate = useInvalidateAfterChange()
  return useMutation({
    mutationFn: (request: AiConnectionUpdate) =>
      aiConnectionApi.create(request),
    onSuccess: invalidate,
  })
}

export const useUpdateAiConnection = (): UseMutationResult<
  AiConnection,
  unknown,
  { id: number; request: AiConnectionUpdate }
> => {
  const invalidate = useInvalidateAfterChange()
  return useMutation({
    mutationFn: ({
      id,
      request,
    }: {
      id: number
      request: AiConnectionUpdate
    }) => aiConnectionApi.update(id, request),
    onSuccess: invalidate,
  })
}

export const useDeleteAiConnection = (): UseMutationResult<
  void,
  unknown,
  number
> => {
  const invalidate = useInvalidateAfterChange()
  return useMutation({
    mutationFn: (id: number) => aiConnectionApi.remove(id),
    onSuccess: invalidate,
  })
}

export const useTestAiConnection = (): UseMutationResult<
  AiConnectionTestResult,
  unknown,
  number
> =>
  useMutation({
    mutationFn: (id: number) => aiConnectionApi.test(id),
  })
