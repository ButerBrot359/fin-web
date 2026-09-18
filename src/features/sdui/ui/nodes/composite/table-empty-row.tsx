import type { FC } from 'react'
import { TableCell, TableRow as MuiTableRow, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

interface TableEmptyRowProps {
  /** Столько колонок, сколько РИСУЕТСЯ, включая колонку «N». */
  colSpan: number
}

/** Заглушка пустой ТЧ — общая для EditableTable и ComplexEditableTable. */
export const TableEmptyRow: FC<TableEmptyRowProps> = ({ colSpan }) => {
  const { t } = useTranslation()
  return (
    <MuiTableRow>
      <TableCell colSpan={colSpan} align="center">
        <Typography variant="body2" color="text.secondary">
          {t('table.empty')}
        </Typography>
      </TableCell>
    </MuiTableRow>
  )
}
