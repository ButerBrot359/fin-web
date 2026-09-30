import { useMemo, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import type { NodeProps } from '../../../../types/view'
import { useBindingValue } from '../../../../lib/sdui-session-context'
import {
  REPORT_SHEET_BINDING,
  useReportCellErrorKeys,
} from '../../../../lib/validation/report-cell-target'
import { parseReportSheetPayload } from './report-sheet-contract'
import { buildReportSheetRows, gridFractionDigits } from './report-sheet-logic'
import { useReportSheetActions } from './use-report-sheet-actions'
import { ReportSheetGrid } from './report-sheet-grid'

/**
 * Узел TABLE с tablePresentation=REPORT_SHEET (report-sheet/v1): карточка
 * экземпляра регламентированного отчёта. Значение — вычисляемая витрина
 * сервера: правка ячейки уходит EDIT_CELL-командой, ответ заменяет value
 * целиком (патч SET_VALUE), локально ячейки не патчатся.
 */
export const ReportSheetTable: FC<NodeProps> = ({ node }) => {
  const { t } = useTranslation()
  const binding = node.binding ?? REPORT_SHEET_BINDING
  const rawValue = useBindingValue(binding)
  // Сетка бывает большой (>200 строк плана): разбор и производные — один раз
  // на серверное обновление, не на каждый рендер.
  const payload = useMemo(() => parseReportSheetPayload(rawValue), [rawValue])
  const rows = useMemo(
    () => (payload ? buildReportSheetRows(payload) : []),
    [payload]
  )
  const fractionDigits = useMemo(
    () => (payload ? gridFractionDigits(payload) : 0),
    [payload]
  )
  const errorKeys = useReportCellErrorKeys()
  const actions = useReportSheetActions(node.id, binding)

  if (!payload) {
    return (
      <Typography variant="body2" sx={{ p: 2, opacity: 0.6 }}>
        {t('sdui.reportSheet.payloadError')}
      </Typography>
    )
  }

  // Пустая сетка — легальное состояние (рубильник выключен, шапка не
  // заполнена, у экземпляра нет вида отчёта), а не ошибка.
  if (payload.grafy.length === 0 && payload.stroki.length === 0) {
    return (
      <Typography
        variant="body2"
        data-testid="report-sheet-empty"
        sx={{ p: 2, textAlign: 'center', opacity: 0.6 }}
      >
        {t('sdui.reportSheet.empty')}
      </Typography>
    )
  }

  return (
    <ReportSheetGrid
      grafy={payload.grafy}
      rows={rows}
      fractionDigits={fractionDigits}
      errorKeys={errorKeys}
      onEditCell={actions.editCell}
      onRasshifrovka={actions.openRasshifrovka}
    />
  )
}
