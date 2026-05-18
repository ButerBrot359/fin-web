import type { FilterCondition, FilterOp } from '@/entities/document-entry'

const OPS_WITHOUT_VALUE = new Set<FilterOp>(['isNull', 'isNotNull'])

const isEmptyValue = (value: unknown): boolean =>
  value === undefined || value === null || value === ''

export const isConditionValid = (condition: FilterCondition): boolean => {
  if (OPS_WITHOUT_VALUE.has(condition.op)) return true

  const { value, op } = condition

  if (op === 'between') {
    if (!Array.isArray(value) || value.length !== 2) return false
    const [lo, hi] = value
    return !isEmptyValue(lo) && !isEmptyValue(hi)
  }

  if (op === 'in' || op === 'notIn') {
    return Array.isArray(value) && value.length > 0
  }

  return !isEmptyValue(value)
}
