import type { FC } from 'react'

import type { CalendarDay } from '../../../lib/calendar/calendar-types'

export interface CalendarDayCellProps {
  dayNumber: number
  day?: CalendarDay // нет в dni → трактуем как нерабочий
  editable: boolean
  onToggle: (data: string) => void
  ariaLabel: string
}

export const CalendarDayCell: FC<CalendarDayCellProps> = ({
  dayNumber,
  day,
  editable,
  onToggle,
  ariaLabel,
}) => {
  const vklyuchen = day?.vklyuchen ?? false
  const ruchnoy = day?.ruchnoy ?? false
  const clickable = editable && day != null

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={vklyuchen}
      data-working={vklyuchen}
      data-manual={ruchnoy}
      disabled={!clickable}
      onClick={() => {
        if (clickable) onToggle(day.data)
      }}
      className={[
        'w-full h-7 text-sm rounded',
        vklyuchen ? 'text-[#2a75f4] font-semibold' : 'text-gray-400',
        ruchnoy ? 'bg-amber-100' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ cursor: clickable ? 'pointer' : 'default' }}
    >
      {dayNumber}
    </button>
  )
}
