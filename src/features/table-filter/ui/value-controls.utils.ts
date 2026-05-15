import type { FilterOp } from '@/entities/document-entry'

export const isRangeOp = (op: FilterOp) => op === 'between'
export const isListOp = (op: FilterOp) => op === 'in' || op === 'notIn'

/** Reset value shape when op changes to/from range/list. */
export const resetValueForOp = (op: FilterOp, prev: unknown): unknown => {
  if (op === 'isNull' || op === 'isNotNull') return undefined
  if (isRangeOp(op))
    return Array.isArray(prev) && prev.length === 2 ? prev : [null, null]
  if (isListOp(op)) return Array.isArray(prev) ? prev : []
  return Array.isArray(prev) ? null : prev
}
