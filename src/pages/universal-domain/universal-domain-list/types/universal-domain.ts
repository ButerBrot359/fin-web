/**
 * Запись универсального домена. Атрибуты типа лежат под `attributes` по коду
 * атрибута — как и у остальных EAV-доменов.
 */
export interface UniversalDomainEntry {
  id: number
  attributes: Record<string, unknown> | null
}
