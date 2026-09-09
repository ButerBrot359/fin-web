import type { FC } from 'react'

import type { CalendarInclusionDay } from '../../../lib/calendar/calendar-types'

export interface CalendarDayCellProps {
  dayNumber: number
  day?: CalendarInclusionDay // нет в days → трактуем как нерабочий
  ariaLabel: string
}

// Ячейка режима inclusion (график работы): просмотр без правки — правка дня
// отключена осознанно с SCRUM-278, триггера toggleDay в контракте нет (B-2).
export const CalendarDayCell: FC<CalendarDayCellProps> = ({
  dayNumber,
  day,
  ariaLabel,
}) => {
  const active = day?.active ?? false
  const manual = day?.manual ?? false

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={active}
      data-working={active}
      data-manual={manual}
      disabled
      className={[
        'w-full h-7 text-sm rounded',
        // Канонизация Ф4: серый нерабочих дней = ui-05, подложка ручной
        // правки = support-03 (Figma warning) с прозрачностью.
        active ? 'text-accent-02 font-semibold' : 'text-ui-05',
        manual ? 'bg-support-03/20' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ cursor: 'default' }}
    >
      {dayNumber}
    </button>
  )
}
