import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

import { formatDate } from '@/shared/lib/utils/date'

export const MONTHS = Array.from({ length: 12 }, (_, i) => i)

// 2024-01-01 — понедельник: эталонная неделя для подписей пн..вс
export const WEEKDAY_LABELS = MONTHS.slice(0, 7).map((i) =>
  format(new Date(2024, 0, 1 + i), 'EEEEEE', { locale: ru })
)

export const monthLabel = (year: number, month: number) =>
  formatDate(new Date(year, month, 1), 'LLLL')

export const dayAriaLabel = (iso: string) => formatDate(iso, 'd MMMM yyyy')
