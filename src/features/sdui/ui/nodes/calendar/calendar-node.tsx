import { useRef, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

import { showToast } from '@/shared/ui/toast/show-toast'

import type { NodeProps } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'
import type { CalendarDay, CalendarNodeProps } from '../../../lib/calendar/calendar-types'
import { MonthGrid } from './month-grid'
import { YearSelector } from './year-selector'
import { CalendarLegend } from './calendar-legend'

const MONTHS = Array.from({ length: 12 }, (_, i) => i)
// 2024-01-01 — понедельник: эталонная неделя для подписей пн..вс
const WEEKDAY_LABELS = MONTHS.slice(0, 7).map((i) =>
  format(new Date(2024, 0, 1 + i), 'EEEEEE', { locale: ru }),
)

export const CalendarNode: FC<NodeProps> = ({ node }) => {
  const p = node.props as CalendarNodeProps | undefined
  const { t } = useTranslation()
  const dispatch = useSduiDispatch()
  const noticeShown = useRef(false)

  const god = p?.god
  if (god == null) return null

  const editable = p?.redaktiruemyy ?? false
  const daysByDate = new Map<string, CalendarDay>()
  for (const d of p?.dni ?? []) daysByDate.set(d.data, d)

  const monthLabel = (m: number) => format(new Date(god, m, 1), 'LLLL', { locale: ru })
  const dayAriaLabel = (y: number, m: number, d: number) =>
    format(new Date(y, m, d), 'd MMMM yyyy', { locale: ru })

  const handleToggle = (data: string) => {
    void dispatch({
      type: 'COMMAND',
      command: 'kalendari.den.toggle',
      value: data,
      sourceNodeId: node.id,
    })
    if (!noticeShown.current) {
      noticeShown.current = true
      showToast('info', t('sdui.calendar.applyImmediately'))
    }
  }

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
        <YearSelector god={god} godMin={p?.godMin} godMax={p?.godMax} onChange={handleYearChange} />
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
              editable={editable}
              onToggle={handleToggle}
              dayAriaLabel={dayAriaLabel}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
