import { useTranslation } from 'react-i18next'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'

import { orDash } from '../lib/audit-log-format'
import { parseChanges } from '../lib/parse-changes'

interface AuditEventChangesProps {
  changes: string | null
}

/**
 * Изменения реквизитов события — «было → стало» по каждому реквизиту. Пусто у создания и у
 * событий сеанса: это не пропуск данных, изменений там нет по смыслу.
 */
export const AuditEventChanges = ({ changes }: AuditEventChangesProps) => {
  const { t } = useTranslation()
  const items = parseChanges(changes)

  return (
    <section className="flex flex-col gap-3">
      <Typography component="h3" variant="h6" fontWeight={700}>
        {t('auditLog.card.changes')}
      </Typography>
      {items.length === 0 ? (
        <Typography variant="body2">{t('auditLog.card.noChanges')}</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('auditLog.card.attribute')}</TableCell>
              <TableCell>{t('auditLog.card.before')}</TableCell>
              <TableCell>{t('auditLog.card.after')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.field} sx={{ verticalAlign: 'top' }}>
                <TableCell sx={{ fontWeight: 600 }}>{item.field}</TableCell>
                <TableCell
                  sx={{ color: 'text.secondary', overflowWrap: 'anywhere' }}
                >
                  {orDash(item.before)}
                </TableCell>
                <TableCell sx={{ overflowWrap: 'anywhere' }}>
                  {orDash(item.after)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
