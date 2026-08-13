import type { FC } from 'react'

import { buildMonthWeeks } from '../../../lib/calendar/build-month-weeks'
import type { CalendarDay } from '../../../lib/calendar/calendar-types'
import { CalendarDayCell } from './calendar-day-cell'

export interface MonthGridProps {
  year: number
  month: number // 0-индексный
  monthLabel: string
  weekdayLabels: string[]
  daysByDate: Map<string, CalendarDay>
  dayAriaLabel: (year: number, month: number, day: number) => string
}

const pad = (n: number) => String(n).padStart(2, '0')

export const MonthGrid: FC<MonthGridProps> = ({
  year,
  month,
  monthLabel,
  weekdayLabels,
  daysByDate,
  dayAriaLabel,
}) => {
  const weeks = buildMonthWeeks(year, month)

  return (
    <div className="flex flex-col gap-1">
      <div className="font-semibold capitalize">{monthLabel}</div>
      <div className="grid grid-cols-7 text-xs text-gray-500">
        {weekdayLabels.map((w, i) => (
          <span key={i} className="text-center">
            {w}
          </span>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7">
          {week.map((cell, ci) => {
            if (cell == null) return <span key={ci} />
            const iso = `${String(year)}-${pad(month + 1)}-${pad(cell)}`
            return (
              <CalendarDayCell
                key={ci}
                dayNumber={cell}
                day={daysByDate.get(iso)}
                ariaLabel={dayAriaLabel(year, month, cell)}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}
