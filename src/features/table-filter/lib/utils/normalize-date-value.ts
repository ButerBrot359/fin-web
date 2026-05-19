import { format, isValid, parseISO } from 'date-fns'

/**
 * Convert ISO string from MUI date picker (always UTC with `Z`) to the
 * local-time format the backend expects for `LocalDate`/`LocalDateTime`:
 *   - DATE     → `YYYY-MM-DD`
 *   - DATETIME → `YYYY-MM-DDTHH:mm:ss`
 *
 * Required because backend rejects values with `Z` suffix / milliseconds
 * with `Value type mismatch ... expected DATETIME, got String`.
 */
export const normalizeDateForBackend = (
  iso: string,
  dateOnly: boolean
): string => {
  if (!iso) return ''
  const parsed = parseISO(iso)
  if (!isValid(parsed)) return ''
  return format(parsed, dateOnly ? 'yyyy-MM-dd' : "yyyy-MM-dd'T'HH:mm:ss")
}
