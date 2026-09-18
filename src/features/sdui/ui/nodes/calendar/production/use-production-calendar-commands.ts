import { useState } from 'react'

import type { ViewAction } from '../../../../types/view'
import type { ProductionCalendarNodeProps } from '../../../../lib/calendar/production-calendar-types'

interface UseProductionCalendarCommandsArgs {
  nodeId: string
  props: ProductionCalendarNodeProps
  draftReady: boolean
  dispatch: (action: ViewAction) => Promise<boolean>
  selectedDate: string | null
  clearSelection: () => void
  closeKindMenu: () => void
  closeTransferDialog: () => void
  resetPrintDismissals: () => void
}

// Команды черновика производственного календаря (вынесено из
// production-calendar-node.tsx, поведение 1:1 при декомпозиции): владеет
// busy-флагом и отправкой draft-команд с полной identity черновика.
export function useProductionCalendarCommands({
  nodeId,
  props: p,
  draftReady,
  dispatch,
  selectedDate,
  clearSelection,
  closeKindMenu,
  closeTransferDialog,
  resetPrintDismissals,
}: UseProductionCalendarCommandsArgs) {
  const [busy, setBusy] = useState(false)

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
      sourceNodeId: nodeId,
      value: {
        draftId: p.draftId,
        expectedDraftVersion: p.draftVersion,
        calendarYear: p.year,
        ...value,
      },
    })
    setBusy(false)
    return ok
  }

  const changeSelectedDay = async (targetKindCode: string) => {
    closeKindMenu()
    if (selectedDate == null) return
    // selectedDates — массив ровно из одного элемента: форма провода (v11 §4.2).
    const ok = await sendDraftCommand('proizvkalendar.dni.izmenit', {
      selectedDates: [selectedDate],
      targetKindCode,
    })
    // Успех очищает выбор (§13.5); неуспех сохраняет его для повтора.
    if (ok) clearSelection()
  }

  const transferDay = async (firstDate: string, secondDate: string) => {
    const ok = await sendDraftCommand('proizvkalendar.den.perenesti', {
      firstDate,
      secondDate,
    })
    if (ok) {
      closeTransferDialog()
      clearSelection()
    }
  }

  const print = () => {
    // Повторный запрос печати снова показывает и warning, и готовый result.
    resetPrintDismissals()
    void sendDraftCommand('proizvkalendar.print')
  }

  return { busy, sendDraftCommand, changeSelectedDay, transferDay, print }
}
