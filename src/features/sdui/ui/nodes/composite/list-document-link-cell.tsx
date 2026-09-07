import { Link, Typography } from '@mui/material'
import type { MouseEvent } from 'react'
import { Link as RouterLink } from 'react-router-dom'

import { armNewTab } from '../../../lib/workspace-tab-gateway'
import type { ListRow } from './list-column-defs'

const readTypeCode = (row: ListRow): string => {
  const raw = row.recorderDocumentTypeCode
  return typeof raw === 'string' ? raw.trim() : ''
}

const readEntryId = (row: ListRow): string => {
  const raw = row.recorderDocumentEntryId
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw)
  if (typeof raw === 'string') return raw.trim()
  return ''
}

interface ListDocumentLinkCellProps {
  row: ListRow
  text: string
}

export const ListDocumentLinkCell = ({
  row,
  text,
}: ListDocumentLinkCellProps) => {
  const typeCode = readTypeCode(row)
  const entryId = readEntryId(row)

  if (!typeCode || !entryId) {
    return (
      <Typography variant="body2" noWrap className="text-ui-06">
        {text}
      </Typography>
    )
  }

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation()
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    if (event.button !== 0) return
    armNewTab()
  }

  return (
    <Link
      component={RouterLink}
      to={`/documents/${encodeURIComponent(typeCode)}/${encodeURIComponent(entryId)}`}
      variant="body2"
      noWrap
      onClick={handleClick}
    >
      {text}
    </Link>
  )
}
