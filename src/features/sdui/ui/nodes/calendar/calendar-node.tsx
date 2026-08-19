import { useState, type FC } from 'react'
import { Button, Menu, MenuItem } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

import type { NodeProps } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'
import type {
  CalendarDayKindDay,
  CalendarInclusionDay,
  CalendarNodeProps,
} from '../../../lib/calendar/calendar-types'
import { MonthGrid } from './month-grid'
import { YearSelector } from './year-selector'
import { CalendarLegend } from './calendar-legend'
import { DayKindLegend } from './day-kind-legend'
import { CalendarDayCell } from './calendar-day-cell'
import { DayKindCell } from './day-kind-cell'

const MONTHS = Array.from({ length: 12 }, (_, i) => i)
// 2024-01-01 — понедельник: эталонная неделя для подписей пн..вс
const WEEKDAY_LABELS = MONTHS.slice(0, 7).map((i) =>
  format(new Date(2024, 0, 1 + i), 'EEEEEE', { locale: ru })
)

// SCRUM-362 B-2: generic-контракт CALENDAR — mode=inclusion (график работы,
// read-only) | dayKind (производственный календарь). Команды приходят
// готовыми действиями узла (changeYear/setDayKind/fillDefaults) — их набор
// зависит от режима и editable; наличие действия = сигнал capability.
export const CalendarNode: FC<NodeProps> = ({ node }) => {
  const { t } = useTranslation()
  const p = node.props as CalendarNodeProps | undefined
  const dispatch = useSduiDispatch()
  const [kindMenu, setKindMenu] = useState<{
    anchor: HTMLElement
    date: string
  } | null>(null)

  const year = p?.year
  if (year == null) return null
  const mode = p?.mode ?? 'inclusion'

  const actionCommand = (trigger: string): string | undefined =>
    node.actions?.find((a) => a.trigger === trigger)?.command
  const changeYearCommand = actionCommand('changeYear')
  const setDayKindCommand = actionCommand('setDayKind')
  const fillDefaultsCommand = actionCommand('fillDefaults')

  const monthLabel = (m: number) =>
    format(new Date(year, m, 1), 'LLLL', { locale: ru })
  const dayAriaLabel = (iso: string) =>
    format(new Date(iso), 'd MMMM yyyy', { locale: ru })

  const handleYearChange = (nextYear: number) => {
    if (!changeYearCommand) return
    void dispatch({
      type: 'COMMAND',
      command: changeYearCommand,
      value: nextYear,
      sourceNodeId: node.id,
    })
  }

  const handleSetDayKind = (date: string, kind: string) => {
    setKindMenu(null)
    if (!setDayKindCommand) return
    void dispatch({
      type: 'COMMAND',
      command: setDayKindCommand,
      value: { date, kind },
      sourceNodeId: node.id,
    })
  }

  const handleFillDefaults = () => {
    if (!fillDefaultsCommand) return
    void dispatch({
      type: 'COMMAND',
      command: fillDefaultsCommand,
      value: year,
      sourceNodeId: node.id,
    })
  }

  const dayKinds = p?.dayKinds ?? []
  const daysByDate = new Map<
    string,
    CalendarInclusionDay | CalendarDayKindDay
  >()
  for (const d of p?.days ?? []) daysByDate.set(d.date, d)

  const renderDay = (iso: string, dayNumber: number) =>
    mode === 'dayKind' ? (
      <DayKindCell
        dayNumber={dayNumber}
        day={daysByDate.get(iso) as CalendarDayKindDay | undefined}
        dayKinds={dayKinds}
        ariaLabel={dayAriaLabel(iso)}
        onOpenMenu={
          setDayKindCommand
            ? (anchor, date) => {
                setKindMenu({ anchor, date })
              }
            : undefined
        }
      />
    ) : (
      <CalendarDayCell
        dayNumber={dayNumber}
        day={daysByDate.get(iso) as CalendarInclusionDay | undefined}
        ariaLabel={dayAriaLabel(iso)}
      />
    )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <YearSelector
            year={year}
            minYear={p?.minYear}
            maxYear={p?.maxYear}
            onChange={handleYearChange}
          />
          {fillDefaultsCommand && (
            <Button
              size="small"
              variant="outlined"
              onClick={handleFillDefaults}
            >
              {t('sdui.calendar.fillDefaults')}
            </Button>
          )}
        </div>
        {mode === 'dayKind' ? (
          <DayKindLegend dayKinds={dayKinds} />
        ) : (
          <CalendarLegend />
        )}
      </div>
      <div className="overflow-x-auto">
        <div className="grid grid-cols-4 gap-4 min-w-[720px]">
          {MONTHS.map((m) => (
            <MonthGrid
              key={m}
              year={year}
              month={m}
              monthLabel={monthLabel(m)}
              weekdayLabels={WEEKDAY_LABELS}
              renderDay={renderDay}
            />
          ))}
        </div>
      </div>
      {setDayKindCommand && (
        <Menu
          anchorEl={kindMenu?.anchor ?? null}
          open={kindMenu != null}
          onClose={() => {
            setKindMenu(null)
          }}
        >
          {dayKinds.map((k) => (
            <MenuItem
              key={k.code}
              onClick={() => {
                if (kindMenu) handleSetDayKind(kindMenu.date, k.code)
              }}
            >
              {k.title}
            </MenuItem>
          ))}
        </Menu>
      )}
    </div>
  )
}
