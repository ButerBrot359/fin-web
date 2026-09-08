import { isValid, parseISO } from 'date-fns'

/**
 * Значение параметра как `Date` для пикера: даты в значениях панели лежат
 * строками `yyyy-MM-dd`. Всё, что не разбирается в дату, даёт null — пикер
 * покажет пустое поле, а не «Invalid Date».
 */
export const toDate = (value: unknown): Date | null => {
  if (value instanceof Date) return isValid(value) ? value : null
  if (typeof value !== 'string' || value === '') return null
  const parsed = parseISO(value)
  return isValid(parsed) ? parsed : null
}
