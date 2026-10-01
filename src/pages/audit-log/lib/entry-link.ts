import type { AuditLogRecord } from '../api/audit-log-api'

/**
 * Плоские маршруты объектов, которые фронт умеет открывать без раздела меню: SDUI и редиректы
 * сами находят раздел (`pageCode`) по типу (см. `sdui-catch-all/lib/kind-to-legacy.tsx`).
 * Для остальных видов метаданных такого входа нет — представление объекта остаётся текстом.
 */
const FLAT_ROUTES: Record<string, string> = {
  DOCUMENT: '/documents',
  DICTIONARY: '/dictionaries',
  INFORMATION_REGISTER: '/information-registers',
}

export const buildEntryLink = (
  record: Pick<AuditLogRecord, 'domainKind' | 'typeCode' | 'entryId'>
): string | null => {
  const base = record.domainKind ? FLAT_ROUTES[record.domainKind] : undefined
  if (!base || !record.typeCode || record.entryId == null) return null
  return `${base}/${encodeURIComponent(record.typeCode)}/${String(record.entryId)}`
}
