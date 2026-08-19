import type { FC, ReactNode } from 'react'

import { buildMonthWeeks } from '../../../lib/calendar/build-month-weeks'

export interface MonthGridProps {
  year: number
  month: number // 0-индексный
  monthLabel: string
  weekdayLabels: string[]
  // SCRUM-362 B-2: сетка не знает режима календаря — ячейку рисует владелец
  // (inclusion / dayKind), сюда приходит только render-функция дня.
  renderDay: (iso: string, dayNumber: number) => ReactNode
}

const pad = (n: number) => String(n).padStart(2, '0')

export const MonthGrid: FC<MonthGridProps> = ({
  year,
  month,
  monthLabel,
  weekdayLabels,
  renderDay,
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
            return <span key={ci}>{renderDay(iso, cell)}</span>
          })}
        </div>
      ))}
    </div>
  )
}
