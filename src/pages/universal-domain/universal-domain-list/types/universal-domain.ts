/**
 * Запись универсального домена. Кастомные атрибуты типа лежат под `attributes`
 * по коду атрибута — как у остальных EAV-доменов. Часть значений (имя/код)
 * бэк отдаёт на верхнем уровне записи (как `DictEntry`), поэтому индекс по
 * строковому ключу разрешён для фолбэка при маппинге колонок.
 */
export interface UniversalDomainEntry {
  id: number
  code?: string | null
  nameRu?: string | null
  nameKz?: string | null
  attributes: Record<string, unknown> | null
  [key: string]: unknown
}
