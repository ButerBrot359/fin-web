import { useTranslation } from 'react-i18next'

import { NetworkChainHops, resolveNetworkChain } from '@/entities/network-chain'

import type { AuditLogRecord } from '../api/audit-log-api'
import {
  applicationDisplay,
  computerDisplay,
  formatOccurredAt,
  metadataDisplay,
  orDash,
  userDisplay,
} from '../lib/audit-log-format'
import { AuditEntryLink } from './audit-entry-link'
import { AuditFieldList } from './audit-field-list'
import { AuditOutcomeChip } from './audit-outcome-chip'

interface AuditEventDetailsProps {
  record: AuditLogRecord
}

/**
 * Все поля события тремя разделами — «Кто и когда», «Откуда», «Что». Сеанс, устройство и адреса
 * показываются полностью (в таблице — сокращённо): их копируют в отбор и в переписку.
 */
export const AuditEventDetails = ({ record }: AuditEventDetailsProps) => {
  const { t } = useTranslation()

  return (
    <>
      <AuditFieldList
        title={t('auditLog.card.who')}
        fields={[
          {
            label: t('auditLog.occurredAt'),
            value: formatOccurredAt(record.occurredAt),
          },
          { label: t('auditLog.user'), value: userDisplay(record) },
          {
            label: t('auditLog.card.userLogin'),
            value: orDash(record.userLogin),
          },
          { label: t('auditLog.card.userIin'), value: orDash(record.userIin) },
          { label: t('auditLog.session'), value: orDash(record.sessionId) },
          {
            label: t('auditLog.application'),
            value: applicationDisplay(record),
          },
          {
            label: t('auditLog.card.userAgent'),
            value: orDash(record.userAgent),
          },
          { label: t('auditLog.card.taskId'), value: orDash(record.taskId) },
          { label: t('auditLog.card.recordId'), value: String(record.id) },
        ]}
      />

      <AuditFieldList
        title={t('auditLog.card.where')}
        fields={[
          { label: t('auditLog.computer'), value: computerDisplay(record) },
          {
            label: t('auditLog.card.deviceId'),
            value: orDash(record.deviceId),
          },
          {
            label: t('auditLog.card.clientLocalIp'),
            value: orDash(record.clientLocalIp),
          },
          {
            label: t('auditLog.card.clientPublicIp'),
            value: orDash(record.clientPublicIp),
          },
          {
            label: t('auditLog.card.clientAddress'),
            value: orDash(record.clientAddress),
          },
          { label: t('auditLog.serverNode'), value: orDash(record.serverNode) },
          {
            label: t('auditLog.card.networkChain'),
            value: <NetworkChainHops hops={resolveNetworkChain(record)} />,
          },
        ]}
      />

      <AuditFieldList
        title={t('auditLog.card.what')}
        fields={[
          {
            label: t('auditLog.event'),
            value: orDash(record.actionPresentation),
          },
          {
            label: t('auditLog.status'),
            value: (
              <AuditOutcomeChip
                outcome={record.outcome}
                presentation={record.outcomePresentation}
              />
            ),
          },
          { label: t('auditLog.metadata'), value: metadataDisplay(record) },
          {
            label: t('auditLog.card.typeCode'),
            value: orDash(record.typeCode),
          },
          {
            label: t('auditLog.data'),
            value: <AuditEntryLink record={record} />,
          },
          { label: t('auditLog.card.entryId'), value: orDash(record.entryId) },
          {
            label: t('auditLog.comment'),
            value: (
              <span className="whitespace-pre-wrap">
                {orDash(record.message)}
              </span>
            ),
          },
        ]}
      />
    </>
  )
}
