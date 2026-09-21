import { useState, type FC } from 'react'
import { Alert } from '@mui/material'
import { useTranslation } from 'react-i18next'

import type { NodeProps } from '../../../../types/view'
import { useSduiDispatch } from '../../../../lib/dispatch'
import type { CalendarDayKindDay } from '../../../../lib/calendar/calendar-types'
import {
  PRODUCTION_CALENDAR_CONTRACT_VERSION,
  type ProductionCalendarNodeProps,
  type ProductionCalendarOperation,
} from '../../../../lib/calendar/production-calendar-types'
import {
  printProjectionDismissKey,
  readPrintProjection,
} from '../../../../lib/calendar/production-calendar-command-results'
import {
  MONTHS,
  WEEKDAY_LABELS,
  dayAriaLabel,
  monthLabel,
} from '../../../../lib/calendar/calendar-format'
import { filterLegendKinds } from '../../../../lib/calendar/legend-kinds'
import { MonthGrid } from '../month-grid'
import { YearSelector } from '../year-selector'
import { DayKindLegend } from '../day-kind-legend'
import { ProductionDayCell } from './production-day-cell'
import { ProductionCalendarToolbar } from './production-calendar-toolbar'
import { ProductionTransferList } from './production-transfer-list'
import { ProductionBaseField } from './production-base-field'
import {
  ProductionCalendarOverlays,
  type MenuPosition,
} from './production-calendar-overlays'
import { useProductionCalendarCommands } from './use-production-calendar-commands'
import { useProductionCalendarYearChange } from './use-production-calendar-year-change'

// Карточка производственного календаря, contract v2 (SCRUM-277). Владеет только
// orchestration-состоянием (§13.4); данные дней/переносов/базы — исключительно
// серверные props, локальных мутаций нет: успех команды приходит replaceNode.
export const ProductionCalendarNode: FC<NodeProps> = ({ node }) => {
  const { t } = useTranslation()
  const p = (node.props ?? {}) as ProductionCalendarNodeProps
  const dispatch = useSduiDispatch()

  // v11 §4: daySelectionMode='single' — выделен не более чем один день; клик по
  // другому дню переносит выделение. Одиночное значение вместо коллекции делает
  // «выбрано два дня» невыразимым состоянием.
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [contextMenuPosition, setContextMenuPosition] =
    useState<MenuPosition>(null)
  const [kindMenuPosition, setKindMenuPosition] = useState<MenuPosition>(null)
  const [dismissedPrintKey, setDismissedPrintKey] = useState<string | null>(
    null
  )
  const [saveWarningDismissed, setSaveWarningDismissed] = useState(false)

  const year = p.year
  const supported =
    p.productionCalendarContractVersion === PRODUCTION_CALENDAR_CONTRACT_VERSION

  const ops = new Set<ProductionCalendarOperation>(p.allowedOperations ?? [])
  const draftReady =
    supported && p.draftId != null && p.draftVersion != null && year != null
  const editable = draftReady && p.editable === true

  const { busy, sendDraftCommand, changeSelectedDay, transferDay, print } =
    useProductionCalendarCommands({
      nodeId: node.id,
      props: p,
      draftReady,
      dispatch,
      selectedDate,
      clearSelection: () => {
        setSelectedDate(null)
      },
      closeKindMenu: () => {
        setKindMenuPosition(null)
      },
      closeTransferDialog: () => {
        setTransferDialogOpen(false)
      },
      resetPrintDismissals: () => {
        setSaveWarningDismissed(false)
        setDismissedPrintKey(null)
      },
    })

  const yearChange = useProductionCalendarYearChange({
    nodeId: node.id,
    props: p,
    sendDraftCommand,
    dispatch,
  })

  if (year == null) return null

  const dayKinds = p.dayKinds ?? []
  const daysByDate = new Map<string, CalendarDayKindDay>()
  for (const d of p.days ?? []) daysByDate.set(d.date, d)

  const canChangeDay = editable && ops.has('CHANGE_DAY')
  const canTransferSelected =
    editable && ops.has('TRANSFER_DAY') && selectedDate != null
  const canFillYear = editable && ops.has('FILL_YEAR')
  const canPrint = draftReady && ops.has('PRINT')

  // Неполный год: у source-даты может не быть физической строки в days
  const sourceDay = selectedDate
    ? (daysByDate.get(selectedDate) ?? { date: selectedDate, kind: null })
    : null

  const projection = supported ? readPrintProjection(p) : null
  const printKey = projection ? printProjectionDismissKey(projection) : null
  const printOpen = projection != null && printKey !== dismissedPrintKey
  const saveWarningOpen =
    supported &&
    p.commandOutcome === 'PRINT_SAVE_REQUIRED' &&
    !saveWarningDismissed

  const toggleDate = (date: string) => {
    // Клик по другому дню переносит выделение, по выбранному — снимает (v11 §4.4).
    setSelectedDate((prev) => (prev === date ? null : date))
  }

  const openContextMenu = (
    date: string,
    position: { left: number; top: number }
  ) => {
    // Правый клик выбирает дату (§13.5).
    setSelectedDate(date)
    setContextMenuPosition(position)
  }

  const cellAriaLabel = (iso: string) => {
    const day = daysByDate.get(iso)
    const parts = [dayAriaLabel(iso)]
    if (day?.kindTitle) parts.push(day.kindTitle)
    if (day?.transferDate) {
      parts.push(
        t('sdui.productionCalendar.transferredTo', { date: day.transferDate })
      )
    }
    return parts.join(', ')
  }

  return (
    <div className="flex flex-col gap-3">
      {!supported && (
        <Alert severity="warning">
          {t('sdui.productionCalendar.unsupportedContract')}
        </Alert>
      )}
      {supported && !editable && (
        <Alert severity="info">{t('sdui.productionCalendar.readOnly')}</Alert>
      )}
      {saveWarningOpen && (
        <Alert
          severity="warning"
          onClose={() => {
            setSaveWarningDismissed(true)
          }}
        >
          {t('sdui.productionCalendar.printSaveRequired')}
        </Alert>
      )}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <YearSelector
          year={year}
          minYear={p.minYear}
          maxYear={p.maxYear}
          onChange={(nextYear) => {
            if (nextYear !== year) void yearChange.requestYearChange(nextYear)
          }}
        />
        {/* v13/v15 §3: легенда — фильтрованная проекция (Суббота/Воскресенье
            только при наличии в году); меню «Изменить день» ниже получает
            полный dayKinds. Пересчёт на каждый рендер — days приезжают патчем
            узла после каждой команды, отдельного server state нет. */}
        <DayKindLegend dayKinds={filterLegendKinds(dayKinds, p.days)} />
      </div>
      <ProductionCalendarToolbar
        hasSelection={selectedDate != null}
        canChangeDay={canChangeDay}
        canTransferDay={canTransferSelected}
        canFillYear={canFillYear}
        canPrint={canPrint}
        busy={busy || yearChange.busy}
        onChangeDay={setKindMenuPosition}
        onTransferDay={() => {
          setTransferDialogOpen(true)
        }}
        onFillYear={() => {
          void sendDraftCommand('proizvkalendar.god.zapolnit')
        }}
        onPrint={print}
      />
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
                <ProductionDayCell
                  dayNumber={dayNumber}
                  date={iso}
                  day={daysByDate.get(iso)}
                  dayKinds={dayKinds}
                  ariaLabel={cellAriaLabel(iso)}
                  selected={selectedDate === iso}
                  selectable={canChangeDay && !busy}
                  onToggle={toggleDate}
                  onContextMenu={editable ? openContextMenu : undefined}
                />
              )}
            />
          ))}
        </div>
      </div>
      {p.baseVisible === true && (
        <ProductionBaseField
          hasBaseCalendar={p.hasBaseCalendar === true}
          baseCalendarEntryId={p.baseCalendarEntryId ?? null}
          candidates={p.baseCandidates ?? []}
          busy={busy}
          editable={editable}
          onEnable={() => {
            void sendDraftCommand('proizvkalendar.base.enable')
          }}
          onClear={() => {
            void sendDraftCommand('proizvkalendar.base.clear')
          }}
          onSelect={(entryId) => {
            void sendDraftCommand('proizvkalendar.base.select', {
              baseCalendarEntryId: entryId,
            })
          }}
        />
      )}
      <ProductionTransferList transfers={p.transfers ?? []} />
      <ProductionCalendarOverlays
        contextMenuPosition={contextMenuPosition}
        setContextMenuPosition={setContextMenuPosition}
        kindMenuPosition={kindMenuPosition}
        setKindMenuPosition={setKindMenuPosition}
        transferDialogOpen={transferDialogOpen}
        setTransferDialogOpen={setTransferDialogOpen}
        canChangeDay={canChangeDay}
        canTransferSelected={canTransferSelected}
        selectedDate={selectedDate}
        dayKinds={dayKinds}
        sourceDay={sourceDay}
        year={year}
        busy={busy}
        onChangeDayKind={(kindCode) => {
          void changeSelectedDay(kindCode)
        }}
        onTransferDay={(firstDate, secondDate) => {
          void transferDay(firstDate, secondDate)
        }}
        yearChange={yearChange}
        projection={projection}
        printOpen={printOpen}
        onDismissPrint={() => {
          setDismissedPrintKey(printKey)
        }}
      />
    </div>
  )
}
