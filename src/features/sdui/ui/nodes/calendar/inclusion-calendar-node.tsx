import type { FC } from 'react'

import type { NodeProps } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'
import type {
  CalendarInclusionDay,
  CalendarNodeProps,
} from '../../../lib/calendar/calendar-types'
import {
  MONTHS,
  WEEKDAY_LABELS,
  dayAriaLabel,
  monthLabel,
} from '../../../lib/calendar/calendar-format'
import { MonthGrid } from './month-grid'
import { YearSelector } from './year-selector'
import { CalendarLegend } from './calendar-legend'
import { CalendarDayCell } from './calendar-day-cell'

// Режим inclusion (график работы, read-only с SCRUM-278): контракт B-2 без
// изменений — год целиком, единственная команда узла changeYear.
export const InclusionCalendarNode: FC<NodeProps> = ({ node }) => {
  const p = node.props as CalendarNodeProps | undefined
  const dispatch = useSduiDispatch()

  const year = p?.year
  if (year == null) return null

  const changeYearCommand = node.actions?.find(
    (a) => a.trigger === 'changeYear'
  )?.command

  const handleYearChange = (nextYear: number) => {
    if (!changeYearCommand) return
    void dispatch({
      type: 'COMMAND',
      command: changeYearCommand,
      value: nextYear,
      sourceNodeId: node.id,
    })
  }

  const daysByDate = new Map<string, CalendarInclusionDay>()
  for (const d of (p?.days ?? []) as CalendarInclusionDay[]) {
    daysByDate.set(d.date, d)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <YearSelector
          year={year}
          minYear={p?.minYear}
          maxYear={p?.maxYear}
          onChange={handleYearChange}
        />
        <CalendarLegend />
      </div>
      <div className="overflow-x-auto">
        <div className="grid grid-cols-4 gap-4 min-w-[720px]">
          {MONTHS.map((m) => (
            <MonthGrid
              key={m}
              year={year}
              month={m}
              monthLabel={monthLabel(year, m)}
              weekdayLabels={WEEKDAY_LABELS}
              renderDay={(iso, dayNumber) => (
                <CalendarDayCell
                  dayNumber={dayNumber}
                  day={daysByDate.get(iso)}
                  ariaLabel={dayAriaLabel(iso)}
                />
              )}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
