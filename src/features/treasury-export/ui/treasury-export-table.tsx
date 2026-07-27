import { useTranslation } from 'react-i18next'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'

import type { TreasuryExportPreviewRow } from '../types/treasury-export'

interface Props {
  rows: TreasuryExportPreviewRow[]
}

/** Таблица «Выгружаемые документы» (паритет 1С). Готова к многострочности. */
export const TreasuryExportTable = ({ rows }: Props) => {
  const { t } = useTranslation()

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>{t('treasuryExport.colN')}</TableCell>
          <TableCell>{t('treasuryExport.colDocument')}</TableCell>
          <TableCell align="right">{t('treasuryExport.colAmount')}</TableCell>
          <TableCell>{t('treasuryExport.colErrors')}</TableCell>
          <TableCell>{t('treasuryExport.colFileName')}</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={`${row.typeCode}-${row.documentId}`}>
            <TableCell>{row.n}</TableCell>
            <TableCell>
              <Typography variant="body2">{row.presentation}</Typography>
            </TableCell>
            <TableCell align="right">
              <Typography variant="body2">{row.amount ?? ''}</Typography>
            </TableCell>
            <TableCell>
              {row.errors.length > 0 && (
                <Typography variant="body2" color="error">
                  {row.errors.join('; ')}
                </Typography>
              )}
            </TableCell>
            <TableCell>
              <Typography variant="body2">{row.fileName ?? ''}</Typography>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
