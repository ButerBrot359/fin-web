import { getDay, getDaysInMonth } from 'date-fns'

import type { WeekCell } from './calendar-types'

// month — 0-индексный (0 = январь). Понедельник — первый день недели.
export function buildMonthWeeks(year: number, month: number): WeekCell[][] {
  const first = new Date(year, month, 1)
  const daysInMonth = getDaysInMonth(first)
  // getDay: 0=вс..6=сб → приводим к пн-первому: 0=пн..6=вс
  const leading = (getDay(first) + 6) % 7

  const cells: WeekCell[] = []
  for (let i = 0; i < leading; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks: WeekCell[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}
