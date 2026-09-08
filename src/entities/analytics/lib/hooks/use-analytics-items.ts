import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'

import { analyticsApi } from '../../api/analytics-api'
import { analyticsKeys } from '../query-keys'
import type {
  AnalyticsItem,
  AnalyticsItemSaveRequest,
  AnalyticsItemSummary,
} from '../../types/item'
import type { AnalyticsItemKind } from '../../types/spec'

/** Список сохранённых дашбордов и отчётов; без `kind` — всё вместе. */
export const useAnalyticsItems = (
  kind?: AnalyticsItemKind
): { items: AnalyticsItemSummary[]; isLoading: boolean } => {
  const { data, isLoading } = useQuery({
    queryKey: analyticsKeys.items(kind),
    queryFn: ({ signal }) => analyticsApi.listItems(kind, signal),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  return { items: data ?? [], isLoading }
}

/**
 * Один сохранённый объект вместе со спецификацией. Диспетчер раздела по нему
 * решает, что рендерить: дашборд или отчёт.
 */
export const useAnalyticsItem = (
  code: string | undefined
): { item: AnalyticsItem | null; isLoading: boolean; isError: boolean } => {
  const { data, isLoading, isError } = useQuery({
    queryKey: analyticsKeys.item(code ?? ''),
    queryFn: ({ signal }) => analyticsApi.getItem(code!, signal),
    enabled: !!code,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  return { item: data ?? null, isLoading, isError }
}

/** Все варианты списка: общий и по каждому виду. */
const ITEM_LIST_KINDS: (AnalyticsItemKind | undefined)[] = [
  undefined,
  'DASHBOARD',
  'REPORT',
]

/**
 * Сохранение объекта. Инвалидируем оба списка (`all` и список своего вида) —
 * при создании из ассистента заранее неизвестно, какой из них открыт.
 */
export const useSaveAnalyticsItem = (): UseMutationResult<
  AnalyticsItem,
  unknown,
  AnalyticsItemSaveRequest
> => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: AnalyticsItemSaveRequest) =>
      analyticsApi.saveItem(request),
    onSuccess: (item) => {
      void queryClient.invalidateQueries({ queryKey: analyticsKeys.items() })
      void queryClient.invalidateQueries({
        queryKey: analyticsKeys.items(item.kind),
      })
      void queryClient.invalidateQueries({
        queryKey: analyticsKeys.item(item.code),
      })
    },
  })
}

/**
 * Удаление по коду. Вид удалённого объекта в ответе не приходит, поэтому
 * сбрасываем все варианты списка, а не только список своего вида.
 */
export const useDeleteAnalyticsItem = (): UseMutationResult<
  void,
  unknown,
  string
> => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (code: string) => analyticsApi.deleteItem(code),
    onSuccess: (_result, code) => {
      for (const kind of ITEM_LIST_KINDS) {
        void queryClient.invalidateQueries({
          queryKey: analyticsKeys.items(kind),
        })
      }
      void queryClient.invalidateQueries({
        queryKey: analyticsKeys.item(code),
      })
    },
  })
}
