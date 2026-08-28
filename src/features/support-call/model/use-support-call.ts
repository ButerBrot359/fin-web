import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supportCallApi } from '../api/support-call-api'
import type { SupportCallStartRequest } from './types'

export const SUPPORT_QUEUE_KEY = ['support', 'queue'] as const

/**
 * Очередь обращений для смены поддержки.
 *
 * Опрос, а не подписка: отдельного канала для очереди на бэкенде нет, а обращения приходят
 * редко — держать ради них WebSocket дороже, чем раз в несколько секунд спросить список.
 * Пять секунд выбраны как компромисс: звонящий не ждёт заметно дольше, а нагрузки на сервер
 * это не создаёт.
 *
 * @param enabled опрашивать только у агентов поддержки — остальным список недоступен (403).
 */
export const useSupportQueue = (enabled: boolean) =>
  useQuery({
    queryKey: SUPPORT_QUEUE_KEY,
    queryFn: ({ signal }) => supportCallApi.listOpen(signal),
    enabled,
    refetchInterval: enabled ? 5_000 : false,
    // Очередь обязана обновляться и в фоновой вкладке: агент держит webbuh открытым в
    // соседней вкладке и должен видеть звонок, не переключаясь в неё.
    refetchIntervalInBackground: true,
    staleTime: 0,
  })

/**
 * Разговор, в который нужно вернуться после перезагрузки страницы.
 *
 * Спрашивается один раз при загрузке и не опрашивается дальше: пока вкладка жива, состояние
 * разговора клиент знает сам, а этот запрос нужен ровно для случая «вкладку перезагрузили,
 * а собеседник остался в комнате».
 */
export const useActiveSupportSession = (enabled: boolean) =>
  useQuery({
    queryKey: ['support', 'active'],
    queryFn: ({ signal }) => supportCallApi.active(signal),
    enabled,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    retry: false,
  })

/** Звонок пользователя в поддержку. */
export const useStartSupportCall = () =>
  useMutation({
    mutationFn: (data: SupportCallStartRequest) => supportCallApi.start(data),
  })

/** Подключение агента к обращению. */
export const useJoinSupportCall = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (callId: number) => supportCallApi.join(callId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: SUPPORT_QUEUE_KEY }),
  })
}

/** Завершение обращения. */
export const useEndSupportCall = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (callId: number) => supportCallApi.end(callId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: SUPPORT_QUEUE_KEY }),
  })
}
