import { useTranslation } from 'react-i18next'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'

import type { AuditLogRecord } from '../api/audit-log-api'

interface AuditLogTableProps {
  rows: AuditLogRecord[]
}

/**
 * Таблица ленты журнала. Русские подписи действий и исходов приходят с сервера
 * (`actionPresentation`, `outcomePresentation`) — см. комментарий на странице.
 * Пустые ячейки — норма: у входа/выхода нет объекта, у неудачного входа может
 * не быть пользователя.
 */
export const AuditLogTable = ({ rows }: AuditLogTableProps) => {
  const { t } = useTranslation()

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>{t('auditLog.occurredAt')}</TableCell>
          <TableCell>{t('auditLog.user')}</TableCell>
          <TableCell>{t('auditLog.action')}</TableCell>
          <TableCell>{t('auditLog.outcome')}</TableCell>
          <TableCell>{t('auditLog.object')}</TableCell>
          <TableCell>{t('auditLog.message')}</TableCell>
          <TableCell>{t('auditLog.clientAddress')}</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="whitespace-nowrap">
              {new Date(row.occurredAt).toLocaleString()}
            </TableCell>
            <TableCell>
              {row.userName ?? row.userLogin ?? ''}
              {row.userLogin && row.userLogin !== row.userName && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  {row.userLogin}
                </Typography>
              )}
            </TableCell>
            <TableCell>{row.actionPresentation}</TableCell>
            <TableCell>{row.outcomePresentation}</TableCell>
            <TableCell>
              {row.entryPresentation ?? ''}
              {row.typeCode && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  {row.typeCode}
                </Typography>
              )}
            </TableCell>
            <TableCell>{row.message ?? ''}</TableCell>
            <TableCell className="whitespace-nowrap">
              {row.clientAddress ?? ''}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
