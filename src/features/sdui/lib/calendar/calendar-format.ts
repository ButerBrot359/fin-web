import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

export const MONTHS = Array.from({ length: 12 }, (_, i) => i)

// 2024-01-01 — понедельник: эталонная неделя для подписей пн..вс
export const WEEKDAY_LABELS = MONTHS.slice(0, 7).map((i) =>
  format(new Date(2024, 0, 1 + i), 'EEEEEE', { locale: ru })
)

export const monthLabel = (year: number, month: number) =>
  format(new Date(year, month, 1), 'LLLL', { locale: ru })

export const dayAriaLabel = (iso: string) =>
  format(new Date(iso), 'd MMMM yyyy', { locale: ru })
