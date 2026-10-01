import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import { resolveNetworkChain } from '@/entities/network-chain'
import { Button } from '@/shared/ui/buttons/button'

import type { AuditLogRecord } from '../api/audit-log-api'
import type { AuditLogFilterValues } from '../lib/audit-log-filters'

interface AuditQuickFiltersProps {
  record: AuditLogRecord
  onApply: (patch: Partial<AuditLogFilterValues>) => void
}

/**
 * Быстрый отбор из карточки: «все события этого сеанса / компьютера / IP / пользователя /
 * объекта» — главный приём разбора инцидента в журнале 1С. Кнопка есть, только если у события
 * есть по чему отбирать. По IP — отдельно адрес компьютера и внешний адрес: это разные вопросы
 * («что делали с этой машины» и «что приходило из этой сети»).
 */
export const AuditQuickFilters = ({
  record,
  onApply,
}: AuditQuickFiltersProps) => {
  const { t } = useTranslation()

  const hops = resolveNetworkChain(record)
  const ips = [
    hops.find((hop) => hop.role === 'LOCAL')?.ip,
    hops.find((hop) => hop.role === 'PUBLIC')?.ip,
  ].filter((ip, index, all): ip is string => !!ip && all.indexOf(ip) === index)

  const options: {
    key: string
    label: string
    patch: Partial<AuditLogFilterValues>
  }[] = []
  if (record.sessionId) {
    options.push({
      key: 'session',
      label: t('auditLog.card.sameSession'),
      patch: { sessionId: record.sessionId },
    })
  }
  if (record.deviceId) {
    options.push({
      key: 'device',
      label: t('auditLog.card.sameComputer'),
      patch: { deviceId: record.deviceId },
    })
  }
  for (const ip of ips) {
    options.push({
      key: `ip-${ip}`,
      label: `${t('auditLog.card.sameIp')}: ${ip}`,
      patch: { ip },
    })
  }
  if (record.userLogin) {
    options.push({
      key: 'user',
      label: t('auditLog.card.sameUser'),
      patch: { userLogin: record.userLogin },
    })
  }
  if (record.entryId != null && record.domainKind) {
    options.push({
      key: 'object',
      label: t('auditLog.card.sameObject'),
      patch: {
        domainKind: record.domainKind,
        typeCode: record.typeCode ?? '',
        entryId: String(record.entryId),
      },
    })
  }

  if (options.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <Typography component="h3" variant="h6" fontWeight={700}>
        {t('auditLog.card.quickFilters')}
      </Typography>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={option.key}
            variant="secondary"
            size="small"
            onClick={() => {
              onApply(option.patch)
            }}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </section>
  )
}
