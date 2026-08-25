import type { FilterCondition } from '@/shared/lib/eav'

export const TABEL_LIST_PERIOD_FIELD = 'Data'

export interface ListPeriod {
  from: string
  to: string
}

/** Builds the same DATE filter the document list's server-side profile uses. */
export const toTabelListPeriodCondition = (
  period: ListPeriod
): FilterCondition | null => {
  const from = period.from.trim()
  const to = period.to.trim()
  if (from && to) {
    return {
      field: TABEL_LIST_PERIOD_FIELD,
      op: 'between',
      value: [from, to],
    }
  }
  if (from) return { field: TABEL_LIST_PERIOD_FIELD, op: 'gte', value: from }
  if (to) return { field: TABEL_LIST_PERIOD_FIELD, op: 'lte', value: to }
  return null
}
