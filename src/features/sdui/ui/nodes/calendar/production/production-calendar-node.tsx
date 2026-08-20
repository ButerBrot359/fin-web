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
import { MonthGrid } from '../month-grid'
import { YearSelector } from '../year-selector'
import { DayKindLegend } from '../day-kind-legend'
import { ProductionDayCell } from './production-day-cell'
import { ProductionCalendarToolbar } from './production-calendar-toolbar'
import { ProductionDayKindMenu } from './production-day-kind-menu'
import { ProductionDayContextMenu } from './production-day-context-menu'
import { ProductionTransferDialog } from './production-transfer-dialog'
import { ProductionTransferList } from './production-transfer-list'
import { ProductionBaseField } from './production-base-field'
import { ProductionYearChangeDialog } from './production-year-change-dialog'
import { ProductionPrintPreview } from './production-print-preview'
import { useProductionCalendarYearChange } from './use-production-calendar-year-change'

type MenuPosition = { left: number; top: number } | null

// Карточка производственного календаря, contract v2 (SCRUM-277). Владеет только
// orchestration-состоянием (§13.4); данные дней/переносов/базы — исключительно
// серверные props, локальных мутаций нет: успех команды приходит replaceNode.
export const ProductionCalendarNode: FC<NodeProps> = ({ node }) => {
  const { t } = useTranslation()
  const p = (node.props ?? {}) as ProductionCalendarNodeProps
  const dispatch = useSduiDispatch()

  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set())
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [contextMenuPosition, setContextMenuPosition] =
    useState<MenuPosition>(null)
  const [kindMenuPosition, setKindMenuPosition] = useState<MenuPosition>(null)
  const [dismissedPrintKey, setDismissedPrintKey] = useState<string | null>(
    null
  )
  const [saveWarningDismissed, setSaveWarningDismissed] = useState(false)
  const [busy, setBusy] = useState(false)

  const year = p.year
  const supported =
    p.productionCalendarContractVersion === PRODUCTION_CALENDAR_CONTRACT_VERSION

  const ops = new Set<ProductionCalendarOperation>(p.allowedOperations ?? [])
  const draftReady =
    supported && p.draftId != null && p.draftVersion != null && year != null
  const editable = draftReady && p.editable === true

  const sendDraftCommand = async (
    command: string,
    value: Record<string, unknown> = {}
  ): Promise<boolean> => {
    // Неполная identity — команду не отправляем (§13.4).
    if (!draftReady) return false
    setBusy(true)
    const ok = await dispatch({
      type: 'COMMAND',
      command,
      sourceNodeId: node.id,
      value: {
        draftId: p.draftId,
        expectedDraftVersion: p.draftVersion,
        calendarYear: year,
        ...value,
      },
    })
    setBusy(false)
    return ok
  }

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
    editable && ops.has('TRANSFER_DAY') && selectedDates.size === 1
  const canFillYear = editable && ops.has('FILL_YEAR')
  const canPrint = draftReady && ops.has('PRINT')

  const sourceDate = selectedDates.size === 1 ? [...selectedDates][0] : null
  // Неполный год: у source-даты может не быть физической строки в days
  const sourceDay = sourceDate
    ? (daysByDate.get(sourceDate) ?? { date: sourceDate, kind: null })
    : null

  const projection = supported ? readPrintProjection(p) : null
  const printKey = projection ? printProjectionDismissKey(projection) : null
  const printOpen = projection != null && printKey !== dismissedPrintKey
  const saveWarningOpen =
    supported &&
    p.commandOutcome === 'PRINT_SAVE_REQUIRED' &&
    !saveWarningDismissed

  const toggleDate = (date: string) => {
    setSelectedDates((prev) => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  const openContextMenu = (
    date: string,
    position: { left: number; top: number }
  ) => {
    // Правый клик выбирает дату (§13.5): не входящая в выбор дата заменяет его.
    setSelectedDates((prev) => (prev.has(date) ? prev : new Set([date])))
    setContextMenuPosition(position)
  }

  const changeSelectedDays = async (targetKindCode: string) => {
    setKindMenuPosition(null)
    if (selectedDates.size === 0) return
    const ok = await sendDraftCommand('proizvkalendar.dni.izmenit', {
      selectedDates: [...selectedDates].sort(),
      targetKindCode,
    })
    // Успех очищает выбор (§13.5); неуспех сохраняет его для повтора.
    if (ok) setSelectedDates(new Set())
  }

  const transferDay = async (firstDate: string, secondDate: string) => {
    const ok = await sendDraftCommand('proizvkalendar.den.perenesti', {
      firstDate,
      secondDate,
    })
    if (ok) {
      setTransferDialogOpen(false)
      setSelectedDates(new Set())
    }
  }

  const print = () => {
    // Повторный запрос печати снова показывает и warning, и готовый result.
    setSaveWarningDismissed(false)
    setDismissedPrintKey(null)
    void sendDraftCommand('proizvkalendar.print')
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
        <DayKindLegend dayKinds={dayKinds} />
      </div>
      <ProductionCalendarToolbar
        selectedCount={selectedDates.size}
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
        onClearSelection={() => {
          setSelectedDates(new Set())
        }}
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
                  selected={selectedDates.has(iso)}
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
      <ProductionDayContextMenu
        position={contextMenuPosition}
        canChangeDay={canChangeDay && selectedDates.size > 0}
        canTransferDay={canTransferSelected}
        onChangeDay={() => {
          setKindMenuPosition(contextMenuPosition)
          setContextMenuPosition(null)
        }}
        onTransferDay={() => {
          setContextMenuPosition(null)
          setTransferDialogOpen(true)
        }}
        onClose={() => {
          setContextMenuPosition(null)
        }}
      />
      <ProductionDayKindMenu
        position={kindMenuPosition}
        dayKinds={dayKinds}
        onPick={(kindCode) => {
          void changeSelectedDays(kindCode)
        }}
        onClose={() => {
          setKindMenuPosition(null)
        }}
      />
      <ProductionTransferDialog
        open={transferDialogOpen}
        sourceDay={sourceDay}
        calendarYear={year}
        busy={busy}
        onConfirm={(firstDate, secondDate) => {
          void transferDay(firstDate, secondDate)
        }}
        onClose={() => {
          setTransferDialogOpen(false)
        }}
      />
      <ProductionYearChangeDialog
        open={yearChange.dialogOpen}
        targetYear={yearChange.pendingYear}
        busy={yearChange.busy}
        onSave={() => {
          void yearChange.save()
        }}
        onDiscard={() => {
          void yearChange.discard()
        }}
        onCancel={yearChange.cancel}
      />
      {projection != null && printOpen && (
        <ProductionPrintPreview
          projection={projection}
          onClose={() => {
            setDismissedPrintKey(printKey)
          }}
        />
      )}
    </div>
  )
}
