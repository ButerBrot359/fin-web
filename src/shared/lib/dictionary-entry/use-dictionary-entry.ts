import { useQuery } from '@tanstack/react-query'

import {
  fetchDictionaryEntryById,
  type DictionaryEntryById,
} from './dictionary-entry-api'

/**
 * Разрешает ID элемента справочника в человекочитаемое имя.
 *
 * Кэширует результат по ID бессрочно (записи справочников стабильны),
 * а одинаковые ID, повторяющиеся в строках грида, дедуплицируются
 * React Query'ем — на каждый уникальный ID один запрос.
 */
export const useDictionaryEntry = (id: number | null | undefined) => {
  const { data, isLoading } = useQuery<DictionaryEntryById>({
    queryKey: ['dictionary-entry-by-id', id],
    queryFn: ({ signal }) => fetchDictionaryEntryById(id!, signal),
    enabled: id != null,
    staleTime: Infinity,
  })

  return { entry: data, isLoading }
}

/** Отображаемое имя записи: displayName → nameRu → code → сам ID. */
export const resolveDictionaryEntryLabel = (
  entry: DictionaryEntryById | undefined,
  fallbackId: number
): string =>
  entry?.displayName ?? entry?.nameRu ?? entry?.code ?? String(fallbackId)
