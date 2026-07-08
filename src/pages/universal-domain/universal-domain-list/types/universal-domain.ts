/**
 * Запись универсального домена. Как и у Dictionary/Document, наименование
 * приходит на верхнем уровне записи (`nameRu`/`nameKz`/`displayName`), а
 * значения атрибутов типа — под `attributes` по коду атрибута.
 */
export interface UniversalDomainEntry {
  id: number
  nameRu?: string | null
  nameKz?: string | null
  displayName?: string | null
  attributes: Record<string, unknown> | null
}
