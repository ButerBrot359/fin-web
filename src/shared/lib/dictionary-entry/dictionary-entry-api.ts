import { apiService } from '@/shared/api/api'

/**
 * Запись справочника, разрешённая по ID.
 *
 * Внимание: эндпоинт `/api/dictionaries/entries/id/{id}` отдаёт объект
 * НАПРЯМУЮ (без обёртки `{ data: ... }`), в отличие от большинства
 * остальных ручек проекта.
 */
export interface DictionaryEntryById {
  id: number
  dictionaryTypeCode?: string
  code?: string | null
  code1C?: string | null
  nameRu?: string | null
  nameKz?: string | null
  displayName?: string | null
}

export const fetchDictionaryEntryById = (
  id: number,
  signal?: AbortSignal
): Promise<DictionaryEntryById> =>
  apiService
    .get<DictionaryEntryById>({
      url: `/api/dictionaries/entries/id/${String(id)}`,
      signal,
    })
    .then((res) => res.data)
