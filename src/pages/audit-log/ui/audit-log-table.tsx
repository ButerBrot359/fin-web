import { useTranslation } from 'react-i18next'

import { Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material'

import type { AuditLogRecord } from '../api/audit-log-api'
import { AuditLogRow } from './audit-log-row'

interface AuditLogTableProps {
  rows: AuditLogRecord[]
  onOpen: (row: AuditLogRecord) => void
}

/**
 * Таблица ленты журнала — колонки журнала регистрации 1С: Дата, Пользователь, Компьютер,
 * Приложение, Событие, Статус, Метаданные, Данные, Сеанс, Рабочий сервер, IP-адреса, Комментарий.
 * Русские подписи событий и статусов приходят с сервера. Колонок много — таблица прокручивается
 * по горизонтали, а не сжимает текст до нечитаемого.
 */
export const AuditLogTable = ({ rows, onOpen }: AuditLogTableProps) => {
  const { t } = useTranslation()

  const headers = [
    t('auditLog.occurredAt'),
    t('auditLog.user'),
    t('auditLog.computer'),
    t('auditLog.application'),
    t('auditLog.event'),
    t('auditLog.status'),
    t('auditLog.metadata'),
    t('auditLog.data'),
    t('auditLog.session'),
    t('auditLog.serverNode'),
    t('auditLog.ip'),
    t('auditLog.comment'),
  ]

  return (
    <div className="overflow-x-auto">
      <Table size="small">
        <TableHead>
          <TableRow>
            {headers.map((header) => (
              <TableCell key={header} className="whitespace-nowrap">
                {header}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <AuditLogRow key={row.id} row={row} onOpen={onOpen} />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
