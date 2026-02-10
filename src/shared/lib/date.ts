import { format, parseISO, isValid } from 'date-fns'
import { ru } from 'date-fns/locale'

export function formatDate(
  date: Date | string,
  formatStr = 'dd.MM.yyyy'
): string {
  const parsed = typeof date === 'string' ? parseISO(date) : date
  if (!isValid(parsed)) return ''
  return format(parsed, formatStr, { locale: ru })
}

export function formatDateTime(date: Date | string): string {
  return formatDate(date, 'dd.MM.yyyy HH:mm')
}

export { parseISO, isValid, format }
