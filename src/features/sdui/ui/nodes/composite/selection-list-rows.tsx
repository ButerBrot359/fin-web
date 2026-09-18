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

import type { ReadOnlyColumnDef } from '../../../lib/utils/read-only-header-model'
import type { SelectionRow } from '../../../lib/hooks/use-selection-publish'
import { renderCellValue } from '../../../lib/utils/cell-value'

interface SelectionListRowsProps {
  columns: ReadOnlyColumnDef[]
  rows: SelectionRow[]
  selectedRowId: string | null
  onRowClick: (row: SelectionRow) => void
}

/** Таблица строк списка-ОТБОРА (вынесено из selection-list-table.tsx 1:1). */
export const SelectionListRows: FC<SelectionListRowsProps> = ({
  columns,
  rows,
  selectedRowId,
  onRowClick,
}) => {
  const { t } = useTranslation()

  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{ flex: '1 1 auto', overflowY: 'auto' }}
    >
      {/* Список-отбор прокручивается внутри себя — шапка закреплена, иначе
          при прокрутке не видно, по какой колонке идёт отбор. */}
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            {columns.map((col) => (
              <TableCell key={col.id}>
                <Typography variant="body2" fontWeight={600}>
                  {col.label}
                </Typography>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={Math.max(columns.length, 1)}>
                <Typography variant="body2" color="text.secondary">
                  {t('table.empty')}
                </Typography>
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => (
            <TableRow
              key={row.rowId}
              hover
              selected={row.rowId === selectedRowId}
              className="cursor-pointer"
              onClick={() => {
                onRowClick(row)
              }}
            >
              {columns.map((col) => (
                <TableCell key={col.id}>
                  {renderCellValue(col.binding ? row[col.binding] : undefined)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
