import { useTranslation } from 'react-i18next'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'

import type { SwiftExportPreviewRow } from '../types/swift-export'

interface Props {
  rows: SwiftExportPreviewRow[]
}

export const SwiftExportTable = ({ rows }: Props) => {
  const { t } = useTranslation()

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>{t('swiftExport.colN')}</TableCell>
          <TableCell>{t('swiftExport.colDocument')}</TableCell>
          <TableCell align="right">{t('swiftExport.colAmount')}</TableCell>
          <TableCell>{t('swiftExport.colErrors')}</TableCell>
          <TableCell>{t('swiftExport.colFileName')}</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.documentId}>
            <TableCell>{row.number}</TableCell>
            <TableCell>
              <Typography variant="body2">{row.documentNumber ?? ''}</Typography>
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
