import { type FC } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

import type { NodeProps } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'
import type {
  CalendarDay,
  CalendarNodeProps,
} from '../../../lib/calendar/calendar-types'
import { MonthGrid } from './month-grid'
import { YearSelector } from './year-selector'
import { CalendarLegend } from './calendar-legend'

const MONTHS = Array.from({ length: 12 }, (_, i) => i)
// 2024-01-01 — понедельник: эталонная неделя для подписей пн..вс
const WEEKDAY_LABELS = MONTHS.slice(0, 7).map((i) =>
  format(new Date(2024, 0, 1 + i), 'EEEEEE', { locale: ru })
)

export const CalendarNode: FC<NodeProps> = ({ node }) => {
  const p = node.props as CalendarNodeProps | undefined
  const dispatch = useSduiDispatch()

  const god = p?.god
  if (god == null) return null

  const daysByDate = new Map<string, CalendarDay>()
  for (const d of p?.dni ?? []) daysByDate.set(d.data, d)

  const monthLabel = (m: number) =>
    format(new Date(god, m, 1), 'LLLL', { locale: ru })
  const dayAriaLabel = (y: number, m: number, d: number) =>
    format(new Date(y, m, d), 'd MMMM yyyy', { locale: ru })

  const handleYearChange = (year: number) => {
    void dispatch({
      type: 'COMMAND',
      command: 'kalendari.god.change',
      value: year,
      sourceNodeId: node.id,
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <YearSelector
          god={god}
          godMin={p?.godMin}
          godMax={p?.godMax}
          onChange={handleYearChange}
        />
        <CalendarLegend />
      </div>
      <div className="overflow-x-auto">
        <div className="grid grid-cols-4 gap-4 min-w-[720px]">
          {MONTHS.map((m) => (
            <MonthGrid
              key={m}
              year={god}
              month={m}
              monthLabel={monthLabel(m)}
              weekdayLabels={WEEKDAY_LABELS}
              daysByDate={daysByDate}
              dayAriaLabel={dayAriaLabel}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
