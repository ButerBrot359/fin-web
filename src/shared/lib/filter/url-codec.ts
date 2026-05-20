import type { FilterCondition, FilterRequest } from '@/shared/lib/eav'

export const EMPTY_FILTER: FilterRequest = { filters: [], logic: 'AND' }

export const isFilterEmpty = (filter: FilterRequest): boolean =>
  filter.filters.length === 0

export const encodeFilterToUrl = (filter: FilterRequest): string | null => {
  if (isFilterEmpty(filter)) return null
  return encodeURIComponent(JSON.stringify(filter))
}

const isFilterCondition = (value: unknown): value is FilterCondition => {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.field === 'string' && typeof v.op === 'string'
}

export const decodeFilterFromUrl = (raw: string | null): FilterRequest => {
  if (!raw) return EMPTY_FILTER
  try {
    const decoded = decodeURIComponent(raw)
    const parsed: unknown = JSON.parse(decoded)
    if (!parsed || typeof parsed !== 'object') return EMPTY_FILTER

    const obj = parsed as Record<string, unknown>
    const filtersRaw = obj.filters
    if (!Array.isArray(filtersRaw)) return EMPTY_FILTER

    const filters = filtersRaw.filter(isFilterCondition)
    const logic = obj.logic === 'OR' ? 'OR' : 'AND'

    return { filters, logic }
  } catch {
    return EMPTY_FILTER
  }
}
