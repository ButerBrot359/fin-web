import type { FC, MouseEvent } from 'react'

import type {
  CalendarDayKind,
  CalendarDayKindDay,
} from '../../../../lib/calendar/calendar-types'
import { dayKindClass } from '../../../../lib/calendar/day-kind-palette'

export interface ProductionDayCellProps {
  dayNumber: number
  date: string
  day?: CalendarDayKindDay
  dayKinds: CalendarDayKind[]
  ariaLabel: string
  selected: boolean
  /** Левый клик тогглит выбор только при доступном CHANGE_DAY. */
  selectable: boolean
  onToggle?: (date: string) => void
  onContextMenu?: (
    date: string,
    position: { left: number; top: number }
  ) => void
}

// Ячейка производственного календаря (contract v2): день с kind=null —
// незаполненный (нейтральный), НЕ рабочий. Перенос показан маркером ↔ и
// в title/aria — дата назначения приходит с бэка (transferDate).
export const ProductionDayCell: FC<ProductionDayCellProps> = ({
  dayNumber,
  date,
  day,
  dayKinds,
  ariaLabel,
  selected,
  selectable,
  onToggle,
  onContextMenu,
}) => {
  const title = day?.kindTitle
    ? day.transferDate
      ? `${day.kindTitle} → ${day.transferDate}`
      : day.kindTitle
    : undefined

  const handleClick = () => {
    if (selectable) onToggle?.(date)
  }

  const handleContextMenu = (e: MouseEvent<HTMLButtonElement>) => {
    if (!onContextMenu) return
    e.preventDefault()
    onContextMenu(date, { left: e.clientX, top: e.clientY })
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={selected}
      data-kind={day?.kind ?? undefined}
      title={title}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      className={[
        'relative w-full h-7 text-sm rounded',
        dayKindClass(dayKinds, day?.kind),
        selected ? 'ring-2 ring-blue-500 ring-inset' : '',
      ].join(' ')}
      style={{ cursor: selectable || onContextMenu ? 'pointer' : 'default' }}
    >
      {dayNumber}
      {day?.transferDate && (
        <span className="absolute top-0 right-0.5 text-[9px] leading-none">
          ↔
        </span>
      )}
    </button>
  )
}
