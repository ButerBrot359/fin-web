import {
  formatNetworkChainShort,
  resolveNetworkChain,
} from '@/entities/network-chain'
import type { XlsxSheet } from '@/shared/lib/xlsx/write-xlsx'

import {
  getAuditLog,
  type AuditLogQuery,
  type AuditLogRecord,
} from '../api/audit-log-api'
import {
  applicationDisplay,
  computerDisplay,
  formatOccurredAt,
  metadataDisplay,
  orDash,
  userDisplay,
} from './audit-log-format'

/** Потолок страницы на сервере — 200; больше за запрос не отдадут. */
export const EXPORT_PAGE_SIZE = 200

/**
 * Потолок выгрузки. Журнал растёт быстрее любой таблицы; выгрузка «всего за год» — работа для
 * сервера, а не для 25+ запросов из браузера. Упёрлись — файл честно говорит, что он неполный.
 */
export const EXPORT_MAX_ROWS = 5000

type ExportQuery = Omit<AuditLogQuery, 'page' | 'size'>

/** Текущая выборка страницами по 200, пока не кончится или не упрётся в потолок. */
export const fetchAuditLogForExport = async (
  query: ExportQuery,
  fetchPage: (
    query: AuditLogQuery
  ) => ReturnType<typeof getAuditLog> = getAuditLog
): Promise<{ rows: AuditLogRecord[]; truncated: boolean }> => {
  const rows: AuditLogRecord[] = []
  let total = 0
  for (let page = 0; rows.length < EXPORT_MAX_ROWS; page += 1) {
    const result = await fetchPage({ ...query, page, size: EXPORT_PAGE_SIZE })
    rows.push(...result.content)
    total = result.totalElements
    if (result.content.length === 0 || page + 1 >= result.totalPages) break
  }
  return {
    rows: rows.slice(0, EXPORT_MAX_ROWS),
    truncated: total > EXPORT_MAX_ROWS,
  }
}

/** Ключи подписей колонок — те же, что у таблицы на экране. */
export type ExportLabelKey =
  | 'auditLog.occurredAt'
  | 'auditLog.user'
  | 'auditLog.computer'
  | 'auditLog.application'
  | 'auditLog.event'
  | 'auditLog.status'
  | 'auditLog.metadata'
  | 'auditLog.data'
  | 'auditLog.session'
  | 'auditLog.serverNode'
  | 'auditLog.ip'
  | 'auditLog.comment'

const COLUMNS: [ExportLabelKey, (record: AuditLogRecord) => string][] = [
  ['auditLog.occurredAt', (record) => formatOccurredAt(record.occurredAt)],
  ['auditLog.user', userDisplay],
  ['auditLog.computer', computerDisplay],
  ['auditLog.application', applicationDisplay],
  ['auditLog.event', (record) => orDash(record.actionPresentation)],
  ['auditLog.status', (record) => orDash(record.outcomePresentation)],
  ['auditLog.metadata', metadataDisplay],
  ['auditLog.data', (record) => orDash(record.entryPresentation)],
  // В файле сеанс — полностью: по нему ищут дальше, а место в Excel не жмёт.
  ['auditLog.session', (record) => orDash(record.sessionId)],
  ['auditLog.serverNode', (record) => orDash(record.serverNode)],
  [
    'auditLog.ip',
    (record) => orDash(formatNetworkChainShort(resolveNetworkChain(record))),
  ],
  ['auditLog.comment', (record) => orDash(record.message)],
]

export const buildAuditLogSheet = (
  rows: AuditLogRecord[],
  label: (key: ExportLabelKey) => string,
  title: string,
  subtitleLines: string[] = []
): XlsxSheet => ({
  name: title.slice(0, 31),
  title,
  subtitleLines,
  headers: COLUMNS.map(([key]) => label(key)),
  rows: rows.map((record) => COLUMNS.map(([, value]) => value(record))),
})
