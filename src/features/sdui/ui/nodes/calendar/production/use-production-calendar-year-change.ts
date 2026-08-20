import { useState } from 'react'

import type { ViewAction } from '../../../../types/view'
import type { ProductionCalendarNodeProps } from '../../../../lib/calendar/production-calendar-types'

interface UseProductionCalendarYearChangeArgs {
  nodeId: string
  props: ProductionCalendarNodeProps
  sendDraftCommand: (
    command: string,
    value?: Record<string, unknown>
  ) => Promise<boolean>
  dispatch: (action: ViewAction) => Promise<boolean>
}

// Смена года (§5.4/§13.9). Исход читается из props ПОСЛЕ ответа (replaceNode),
// а не из результата dispatch: awaiting скрывает диалог, пока не пришёл свежий
// commandOutcome (стёртый предыдущей попыткой SAVE_DISCARD_CANCEL_REQUIRED в
// props не должен открывать диалог до ответа).
export function useProductionCalendarYearChange({
  nodeId,
  props,
  sendDraftCommand,
  dispatch,
}: UseProductionCalendarYearChangeArgs) {
  const [pendingYear, setPendingYear] = useState<number | null>(null)
  const [awaiting, setAwaiting] = useState(false)
  const [busy, setBusy] = useState(false)

  const dialogOpen =
    pendingYear != null &&
    !awaiting &&
    props.commandOutcome === 'SAVE_DISCARD_CANCEL_REQUIRED' &&
    props.lastCommand === 'proizvkalendar.god.change'

  const requestYearChange = async (targetYear: number) => {
    setPendingYear(targetYear)
    setAwaiting(true)
    const ok = await sendDraftCommand('proizvkalendar.god.change', {
      targetYear,
    })
    setAwaiting(false)
    // YEAR_SWITCHED меняет год → ремоунт по key; CURRENT_YEAR — год тот же,
    // диалог не нужен. Неуспех — сбросить намерение.
    if (!ok) setPendingYear(null)
  }

  const cancel = () => {
    setPendingYear(null)
  }

  const discard = async () => {
    if (pendingYear == null) return
    setBusy(true)
    const ok = await sendDraftCommand('proizvkalendar.god.discard-and-open', {
      targetYear: pendingYear,
    })
    setBusy(false)
    if (ok) setPendingYear(null)
  }

  const save = async () => {
    if (pendingYear == null) return
    setBusy(true)
    // Строгая последовательность (§13.9): god.open ТОЛЬКО после успешного
    // общего save; при неуспехе диалог остаётся доступным.
    const savedOk = await dispatch({ type: 'COMMAND', command: 'save' })
    if (!savedOk) {
      setBusy(false)
      return
    }
    const openedOk = await dispatch({
      type: 'COMMAND',
      command: 'proizvkalendar.god.open',
      sourceNodeId: nodeId,
      value: { targetYear: pendingYear },
    })
    setBusy(false)
    if (openedOk) setPendingYear(null)
  }

  return {
    pendingYear,
    dialogOpen,
    busy,
    requestYearChange,
    cancel,
    discard,
    save,
  }
}
