import { Link as RouterLink } from 'react-router-dom'
import { Link } from '@mui/material'

import type { AuditLogRecord } from '../api/audit-log-api'
import { orDash } from '../lib/audit-log-format'
import { buildEntryLink } from '../lib/entry-link'

interface AuditEntryLinkProps {
  record: Pick<
    AuditLogRecord,
    'domainKind' | 'typeCode' | 'entryId' | 'entryPresentation'
  >
}

/**
 * Представление объекта события — ссылкой, если фронт умеет открыть объект этого вида
 * (документ, справочник, регистр сведений); иначе текстом. Клик по ссылке не открывает
 * карточку события: строка журнала кликабельна целиком, и переход в объект — отдельное действие.
 */
export const AuditEntryLink = ({ record }: AuditEntryLinkProps) => {
  const text = orDash(record.entryPresentation)
  const href = buildEntryLink(record)
  if (!href || !record.entryPresentation) return <>{text}</>

  return (
    <Link
      component={RouterLink}
      to={href}
      underline="hover"
      onClick={(event) => {
        event.stopPropagation()
      }}
    >
      {text}
    </Link>
  )
}
