import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { TableCell } from '@mui/material'

import { reportCellKey } from '../../../../lib/validation/report-cell-target'
import type {
  ReportCellAddress,
  ReportSheetCell,
} from './report-sheet-contract'
import {
  formatReportValue,
  isCellEditable,
  type ReportGridCell,
} from './report-sheet-logic'
import {
  absentCellSx,
  ERROR_CELL_SHADOW,
  manualMarkerStyle,
  READ_ONLY_CELL_BG,
  valueCellSx,
} from './report-sheet-sx'
import { ReportSheetCellContent } from './report-sheet-cell'

export interface ReportSheetCellHandlers {
  fractionDigits: number
  /** reportCellKey ячеек — целей текущего отчёта о проверке. */
  errorKeys: ReadonlySet<string>
  onEditCell: (
    address: ReportCellAddress,
    raw: string
  ) => boolean | Promise<boolean>
  onRasshifrovka: (address: ReportCellAddress) => void
}

/** Подпись вида показателя; незнакомый vid — без подписи. */
function vidHintKey(vid: ReportSheetCell['vid']) {
  if (vid === 'ZAPOLNYAEMYY')
    return 'sdui.reportSheet.vid.zapolnyaemyy' as const
  if (vid === 'VYCHISLYAEMYY')
    return 'sdui.reportSheet.vid.vychislyaemyy' as const
  if (vid === 'STROKOVYY') return 'sdui.reportSheet.vid.strokovyy' as const
  return null
}

/**
 * Ячейка графы. data-sdui-report-cell — адрес для навигации панели проверки
 * (REPORT_CELL); пересечение без показателя — заштрихованная пустая клетка.
 */
export const ReportSheetValueCell: FC<
  { cell: ReportGridCell } & ReportSheetCellHandlers
> = ({ cell, fractionDigits, errorKeys, onEditCell, onRasshifrovka }) => {
  const { t } = useTranslation()
  if (!cell) return <TableCell sx={absentCellSx} />

  const key = reportCellKey(cell.pokazatelId, cell.indeks)
  const editable = isCellEditable(cell)
  const vidKey = vidHintKey(cell.vid)
  const hint = [
    vidKey ? t(vidKey) : '',
    cell.izmenenoVruchnuyu ? t('sdui.reportSheet.izmenenoVruchnuyu') : '',
    cell.kod,
  ]
    .filter((line) => line !== '')
    .join('\n')
  const address = { pokazatelId: cell.pokazatelId, indeks: cell.indeks }
  const hasError = errorKeys.has(key)
  return (
    <TableCell
      data-sdui-report-cell={key}
      data-vid={cell.vid}
      data-validation-error={hasError ? 'true' : undefined}
      sx={{
        ...valueCellSx,
        backgroundColor: editable ? undefined : READ_ONLY_CELL_BG,
        boxShadow: hasError ? ERROR_CELL_SHADOW : undefined,
      }}
    >
      <ReportSheetCellContent
        text={formatReportValue(cell.znachenie, fractionDigits)}
        editable={editable}
        hint={hint}
        onCommit={(raw) => onEditCell(address, raw)}
        onRasshifrovka={() => {
          onRasshifrovka(address)
        }}
      />
      {cell.izmenenoVruchnuyu && (
        <span data-testid="report-cell-manual" style={manualMarkerStyle} />
      )}
    </TableCell>
  )
}
