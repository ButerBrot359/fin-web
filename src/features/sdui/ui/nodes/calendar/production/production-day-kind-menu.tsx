import type { FC } from 'react'
import { Menu, MenuItem } from '@mui/material'

import type { CalendarDayKind } from '../../../../lib/calendar/calendar-types'
import { dayKindClass } from '../../../../lib/calendar/day-kind-palette'

export interface ProductionDayKindMenuProps {
  position: { left: number; top: number } | null
  dayKinds: CalendarDayKind[]
  onPick: (kindCode: string) => void
  onClose: () => void
}

// Меню выбора целевого вида дня (§5.2/§13.5): один и тот же список dayKinds,
// что и в легенде/контекстном меню; состав видов приходит с бэка.
export const ProductionDayKindMenu: FC<ProductionDayKindMenuProps> = ({
  position,
  dayKinds,
  onPick,
  onClose,
}) => (
  <Menu
    open={position != null}
    onClose={onClose}
    anchorReference="anchorPosition"
    anchorPosition={position ?? undefined}
  >
    {dayKinds.map((k) => (
      <MenuItem
        key={k.code}
        onClick={() => {
          onPick(k.code)
        }}
      >
        <span
          className={`inline-block w-3 h-3 rounded-sm mr-2 ${dayKindClass(dayKinds, k.code)}`}
        />
        {k.title}
      </MenuItem>
    ))}
  </Menu>
)
