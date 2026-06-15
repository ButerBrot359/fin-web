import { useQuery } from '@tanstack/react-query'

import { fetchDictionaryEntries } from './dictionary-entry-api'

/**
 * Активные записи справочника по коду типа — для выпадашек (отборы/фильтры).
 * Справочники меняются редко, поэтому держим в кэше подольше. Запрос включается
 * только при заданном `typeCode`.
 */
export const useDictionaryEntries = (typeCode: string | null) => {
  const { data, isLoading } = useQuery({
    queryKey: ['dictionary-entries', typeCode, 'active'],
    queryFn: ({ signal }) => fetchDictionaryEntries(typeCode!, signal),
    select: (res) => res.data,
    enabled: typeCode != null && typeCode !== '',
    staleTime: 5 * 60 * 1000,
  })

  return { entries: data ?? [], isLoading }
}
