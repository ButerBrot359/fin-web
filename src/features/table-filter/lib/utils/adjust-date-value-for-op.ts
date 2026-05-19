import type { FilterOp } from '@/entities/document-entry'
import type { DataType } from '@/shared/lib/consts/data-types'

import type { DateEdge } from './normalize-date-value'

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}/

const reapplyEdge = (value: string, edge: DateEdge): string => {
  const match = DATE_ONLY_RE.exec(value)
  if (!match) return value
  return match[0] + (edge === 'end' ? 'T23:59:59' : 'T00:00:00')
}

const edgeForSingleOp = (op: FilterOp): DateEdge =>
  op === 'lt' || op === 'lte' ? 'end' : 'start'

/**
 * Re-derive the synthetic time portion of a DATETIME filter value when the
 * operator changes. Filter UI uses a date-only picker (no time UI), so the
 * suffix `T00:00:00` / `T23:59:59` is synthesized from the operator's intent.
 *
 * Examples (DATETIME column):
 *   value `"2026-04-10T00:00:00"` + new op `lt`        → `"2026-04-10T23:59:59"`
 *   value `["2026-04-10T00:00:00", "2026-04-20T00:00:00"]` + op `between`
 *     → `["2026-04-10T00:00:00", "2026-04-20T23:59:59"]`
 *
 * DATE columns and non-string values pass through unchanged.
 */
export const adjustDateValueForOp = (
  value: unknown,
  op: FilterOp,
  dataType: DataType
): unknown => {
  if (dataType !== 'DATETIME') return value
  if (op === 'between' && Array.isArray(value) && value.length === 2) {
    const [from, to] = value
    return [
      typeof from === 'string' ? reapplyEdge(from, 'start') : from,
      typeof to === 'string' ? reapplyEdge(to, 'end') : to,
    ]
  }
  if (typeof value === 'string') {
    return reapplyEdge(value, edgeForSingleOp(op))
  }
  return value
}
