import { formatDate } from '@/shared/lib/utils/date'

import type { AuditLogRecord } from '../api/audit-log-api'

/** Пустое значение в журнале. Не «ошибка данных»: у входа нет объекта, у старых записей — адресов. */
export const EMPTY_VALUE = '—'

export const orDash = (value: string | number | null | undefined): string => {
  const text = value == null ? '' : String(value).trim()
  return text || EMPTY_VALUE
}

/** Секунды обязательны: журнал — доказательство, и порядок событий внутри минуты важен. */
export const formatOccurredAt = (value: string): string =>
  formatDate(value, 'dd.MM.yyyy HH:mm:ss') || value

/** Сеанс в колонке — первые 8 знаков UUID, полностью — в подсказке и карточке. */
export const shortId = (value: string | null | undefined): string => {
  if (!value) return EMPTY_VALUE
  return value.length > 12 ? value.slice(0, 8) : value
}

export const userDisplay = (record: AuditLogRecord): string =>
  orDash(record.userName ?? record.userLogin)

export const applicationDisplay = (record: AuditLogRecord): string =>
  orDash(record.applicationPresentation ?? record.application)

export const metadataDisplay = (record: AuditLogRecord): string =>
  orDash(record.typePresentation ?? record.typeCode)

export const computerDisplay = (record: AuditLogRecord): string =>
  orDash(record.computer)
