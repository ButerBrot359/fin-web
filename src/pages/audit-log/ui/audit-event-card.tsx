import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'

import { Drawer, Typography } from '@mui/material'

import { cssVar, palette } from '@/shared/design/tokens'
import { Button } from '@/shared/ui/buttons/button'
import { figmaIcons } from '@/shared/ui/icons'

import { getAuditLogRecord, type AuditLogRecord } from '../api/audit-log-api'
import type { AuditLogFilterValues } from '../lib/audit-log-filters'
import { AuditEventChanges } from './audit-event-changes'
import { AuditEventDetails } from './audit-event-details'
import { AuditQuickFilters } from './audit-quick-filters'

interface AuditEventCardProps {
  /** Строка, по которой кликнули; null — карточка закрыта. */
  row: AuditLogRecord | null
  onClose: () => void
  onQuickFilter: (patch: Partial<AuditLogFilterValues>) => void
}

/**
 * Карточка события журнала — боковая панель со всеми полями, полной цепочкой адресов и
 * изменениями реквизитов, как «Событие журнала регистрации» в 1С.
 *
 * Показывается сразу по данным строки, а свежая запись дочитывается `GET /api/audit/{id}`.
 * Не ответил (бэкенд без этого метода, сбой сети) — остаётся строка из списка: в ней те же поля,
 * и отказ здесь — не повод прятать карточку.
 */
export const AuditEventCard = ({
  row,
  onClose,
  onQuickFilter,
}: AuditEventCardProps) => {
  const { t } = useTranslation()
  const { data } = useQuery({
    queryKey: ['audit-log-record', row?.id],
    queryFn: ({ signal }) => getAuditLogRecord(row?.id ?? 0, signal),
    enabled: row != null,
    retry: false,
    staleTime: 60_000,
  })
  const record = row && data?.id === row.id ? data : row

  return (
    <Drawer
      anchor="right"
      open={row != null}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            // Боковая панель по Figma (324:13541): 766, скругление слева 40.
            width: 766,
            maxWidth: '100vw',
            borderTopLeftRadius: 40,
            borderBottomLeftRadius: 40,
            backgroundColor: cssVar(palette.ui01),
          },
        },
      }}
    >
      {record && (
        <div className="flex flex-col gap-8 p-10">
          <div className="flex items-center gap-6">
            <Typography
              component="h2"
              sx={{ flex: 1, fontSize: 26, fontWeight: 700, lineHeight: 1.3 }}
            >
              {t('auditLog.card.title')}
            </Typography>
            <Button
              variant="tertiary"
              aria-label={t('auditLog.card.close')}
              onClick={onClose}
              startIcon={figmaIcons.cross}
            />
          </div>

          <AuditEventDetails record={record} />
          <AuditEventChanges changes={record.changes} />
          <AuditQuickFilters record={record} onApply={onQuickFilter} />
        </div>
      )}
    </Drawer>
  )
}
