import type { FC, MouseEvent } from 'react'

import type {
  CalendarDayKind,
  CalendarDayKindDay,
} from '../../../lib/calendar/calendar-types'
import { dayKindClass } from '../../../lib/calendar/day-kind-palette'

export interface DayKindCellProps {
  dayNumber: number
  day?: CalendarDayKindDay
  dayKinds: CalendarDayKind[]
  ariaLabel: string
  /** Задан только при наличии setDayKind-действия (editable-карточка). */
  onOpenMenu?: (anchor: HTMLElement, date: string) => void
}

// Ячейка режима dayKind (производственный календарь): день не тогглится,
// а получает вид из меню (setDayKind) — контракт B-2, триггера toggleDay нет.
export const DayKindCell: FC<DayKindCellProps> = ({
  dayNumber,
  day,
  dayKinds,
  ariaLabel,
  onOpenMenu,
}) => {
  const editable = !!onOpenMenu && !!day
  const title = day?.kindTitle
    ? day.transferDate
      ? `${day.kindTitle} → ${day.transferDate}`
      : day.kindTitle
    : undefined

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (onOpenMenu && day) onOpenMenu(e.currentTarget, day.date)
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      data-kind={day?.kind ?? undefined}
      title={title}
      disabled={!editable}
      onClick={handleClick}
      className={[
        'w-full h-7 text-sm rounded',
        dayKindClass(dayKinds, day?.kind),
      ].join(' ')}
      style={{ cursor: editable ? 'pointer' : 'default' }}
    >
      {dayNumber}
    </button>
  )
}
