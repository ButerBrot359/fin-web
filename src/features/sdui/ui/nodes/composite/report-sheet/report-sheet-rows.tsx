import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { TableCell, TableRow, Typography } from '@mui/material'

import { cssVar, semantic } from '@/shared/design/tokens'

import { reportCellKey } from '../../../../lib/validation/report-cell-target'
import type { ReportSheetRow } from './report-sheet-logic'
import { codeCellSx, indentPx, nameCellSx } from './report-sheet-sx'
import {
  ReportSheetValueCell,
  type ReportSheetCellHandlers,
} from './report-sheet-value-cell'

/** Строка грида: заголовок раздела, строка показателей или раскрытие. */
export const ReportSheetRowView: FC<
  { row: ReportSheetRow; grafaCount: number } & ReportSheetCellHandlers
> = ({ row, grafaCount, ...handlers }) => {
  const { t } = useTranslation()
  const indent = `${String(indentPx(row.uroven))}px`

  if (row.kind === 'group') {
    return (
      <TableRow data-row-kind="group">
        <TableCell sx={nameCellSx}>
          <Typography variant="body2" sx={{ fontWeight: 700, pl: indent }}>
            {row.nameRu}
          </Typography>
        </TableCell>
        <TableCell sx={{ ...codeCellSx, fontWeight: 700 }}>{row.kod}</TableCell>
        {grafaCount > 0 && <TableCell colSpan={grafaCount} />}
      </TableRow>
    )
  }

  const raskrytie = row.kind === 'raskrytie'
  return (
    <TableRow hover data-row-kind={row.kind}>
      <TableCell sx={nameCellSx}>
        <Typography
          variant="body2"
          sx={{
            pl: indent,
            fontStyle: raskrytie ? 'italic' : undefined,
            color: raskrytie ? cssVar(semantic.textSecondary) : undefined,
          }}
        >
          {raskrytie
            ? t('sdui.reportSheet.raskrytieRow', { indeks: row.indeks })
            : row.nameRu}
        </Typography>
      </TableCell>
      <TableCell sx={codeCellSx}>{raskrytie ? '' : row.kod}</TableCell>
      {row.cells.map((cell, i) => (
        <ReportSheetValueCell
          key={
            cell
              ? reportCellKey(cell.pokazatelId, cell.indeks)
              : `empty-${String(i)}`
          }
          cell={cell}
          {...handlers}
        />
      ))}
    </TableRow>
  )
}
