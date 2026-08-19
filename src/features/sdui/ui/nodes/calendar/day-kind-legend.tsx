import type { FC } from 'react'

import type { CalendarDayKind } from '../../../lib/calendar/calendar-types'
import { dayKindClass } from '../../../lib/calendar/day-kind-palette'

// Легенда режима dayKind: виды дня приходят с бэка (props.dayKinds),
// соответствие цветов — то же, что у ячеек (по индексу вида).
export const DayKindLegend: FC<{ dayKinds: CalendarDayKind[] }> = ({
  dayKinds,
}) => (
  <div className="flex items-center gap-4 text-sm">
    {dayKinds.map((k) => (
      <span key={k.code} className="flex items-center gap-1">
        <span
          className={`inline-block w-3 h-3 rounded-sm ${dayKindClass(dayKinds, k.code)}`}
        />
        {k.title}
      </span>
    ))}
  </div>
)
