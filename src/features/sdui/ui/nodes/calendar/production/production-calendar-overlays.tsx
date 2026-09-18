import type { FC } from 'react'

import type {
  CalendarDayKind,
  CalendarDayKindDay,
} from '../../../../lib/calendar/calendar-types'
import type { ProductionCalendarPrintProjection } from '../../../../lib/calendar/production-calendar-command-results'
import { ProductionDayKindMenu } from './production-day-kind-menu'
import { ProductionDayContextMenu } from './production-day-context-menu'
import { ProductionTransferDialog } from './production-transfer-dialog'
import { ProductionYearChangeDialog } from './production-year-change-dialog'
import { ProductionPrintPreview } from './production-print-preview'
import type { useProductionCalendarYearChange } from './use-production-calendar-year-change'

export type MenuPosition = { left: number; top: number } | null

interface ProductionCalendarOverlaysProps {
  contextMenuPosition: MenuPosition
  setContextMenuPosition: (position: MenuPosition) => void
  kindMenuPosition: MenuPosition
  setKindMenuPosition: (position: MenuPosition) => void
  transferDialogOpen: boolean
  setTransferDialogOpen: (open: boolean) => void
  canChangeDay: boolean
  canTransferSelected: boolean
  selectedDate: string | null
  dayKinds: CalendarDayKind[]
  sourceDay: CalendarDayKindDay | null
  year: number
  busy: boolean
  onChangeDayKind: (kindCode: string) => void
  onTransferDay: (firstDate: string, secondDate: string) => void
  yearChange: ReturnType<typeof useProductionCalendarYearChange>
  projection: ProductionCalendarPrintProjection | null
  printOpen: boolean
  onDismissPrint: () => void
}

// Меню и диалоги производственного календаря (вынесено из
// production-calendar-node.tsx, поведение 1:1 при декомпозиции): чистая
// раскладка оверлеев, orchestration-состоянием владеет узел.
export const ProductionCalendarOverlays: FC<
  ProductionCalendarOverlaysProps
> = ({
  contextMenuPosition,
  setContextMenuPosition,
  kindMenuPosition,
  setKindMenuPosition,
  transferDialogOpen,
  setTransferDialogOpen,
  canChangeDay,
  canTransferSelected,
  selectedDate,
  dayKinds,
  sourceDay,
  year,
  busy,
  onChangeDayKind,
  onTransferDay,
  yearChange,
  projection,
  printOpen,
  onDismissPrint,
}) => (
  <>
    <ProductionDayContextMenu
      position={contextMenuPosition}
      canChangeDay={canChangeDay && selectedDate != null}
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
        onChangeDayKind(kindCode)
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
        onTransferDay(firstDate, secondDate)
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
        onClose={onDismissPrint}
      />
    )}
  </>
)
