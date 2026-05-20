import { format, isValid, parseISO } from 'date-fns'

import type { DataType } from '@/shared/lib/consts/data-types'

export type DateEdge = 'start' | 'end'

/**
 * Convert ISO string from MUI DatePicker (always UTC with `Z`) into the
 * local-time format the backend expects:
 *   - DATE     → `YYYY-MM-DD`
 *   - DATETIME → `YYYY-MM-DDT00:00:00` (start of day, default)
 *             → `YYYY-MM-DDT23:59:59` (end of day, for `lt`/`lte`/`between[1]`)
 *
 * DATETIME columns in the filter UI are rendered as a date-only picker
 * (no time input), so we synthesize the time portion server-side based
 * on the operator's intent — see `adjustDateValueForOp` for re-derivation
 * when the operator changes.
 *
 * Required because backend rejects values with `Z` suffix / milliseconds
 * with `Value type mismatch ... expected DATETIME, got String`.
 */
export const normalizeDateForBackend = (
  iso: string,
  dataType: DataType,
  edge: DateEdge = 'start'
): string => {
  if (!iso) return ''
  const parsed = parseISO(iso)
  if (!isValid(parsed)) return ''
  const datePart = format(parsed, 'yyyy-MM-dd')
  if (dataType === 'DATE') return datePart
  return datePart + (edge === 'end' ? 'T23:59:59' : 'T00:00:00')
}
