import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'

import { cssVar, semantic } from '@/shared/design/tokens'

import { TABLE_GRID_SX } from '../table-grid-sx'
import type { ReportSheetGrafa } from './report-sheet-contract'
import type { ReportSheetRow } from './report-sheet-logic'
import { ReportSheetRowView } from './report-sheet-rows'
import {
  headCodeSx,
  headNameSx,
  VALUE_COLUMN_MIN_WIDTH,
} from './report-sheet-sx'
import type { ReportSheetCellHandlers } from './report-sheet-value-cell'

interface ReportSheetGridProps extends ReportSheetCellHandlers {
  grafy: ReportSheetGrafa[]
  rows: ReportSheetRow[]
}

/**
 * Сетка «строки × графы» экземпляра отчёта: наименование и код строки
 * закреплены слева, по колонке на графу из value.grafy (TABLE_COLUMN у узла
 * нет). Номер печатной графы — подписью над наименованием графы.
 */
export const ReportSheetGrid: FC<ReportSheetGridProps> = ({
  grafy,
  rows,
  ...handlers
}) => {
  const { t } = useTranslation()

  return (
    <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
      <Table size="small" stickyHeader sx={TABLE_GRID_SX}>
        <TableHead>
          <TableRow>
            <TableCell sx={headNameSx}>
              {t('sdui.reportSheet.nameColumn')}
            </TableCell>
            <TableCell sx={headCodeSx}>
              {t('sdui.reportSheet.codeColumn')}
            </TableCell>
            {grafy.map((g) => (
              <TableCell
                key={g.kod}
                sx={{
                  minWidth: VALUE_COLUMN_MIN_WIDTH,
                  textAlign: 'center',
                  verticalAlign: 'top',
                }}
              >
                {g.nomerPechatnoyGrafy != null && (
                  <Typography
                    component="div"
                    variant="caption"
                    sx={{ color: cssVar(semantic.textSecondary) }}
                  >
                    {t('sdui.reportSheet.grafaNumber', {
                      nomer: g.nomerPechatnoyGrafy,
                    })}
                  </Typography>
                )}
                <Typography component="div" variant="body2">
                  {g.nameRu}
                </Typography>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <ReportSheetRowView
              key={row.key}
              row={row}
              grafaCount={grafy.length}
              {...handlers}
            />
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={grafy.length + 2}>
                <Typography
                  variant="body2"
                  sx={{ textAlign: 'center', opacity: 0.6, p: 1 }}
                >
                  {t('sdui.reportSheet.noRows')}
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
