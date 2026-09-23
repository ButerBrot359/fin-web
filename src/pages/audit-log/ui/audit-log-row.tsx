import { TableCell, TableRow, Tooltip, Typography } from '@mui/material'

import { NetworkChainView, resolveNetworkChain } from '@/entities/network-chain'

import type { AuditLogRecord } from '../api/audit-log-api'
import {
  applicationDisplay,
  computerDisplay,
  formatOccurredAt,
  metadataDisplay,
  orDash,
  shortId,
  userDisplay,
} from '../lib/audit-log-format'
import { AuditEntryLink } from './audit-entry-link'
import { AuditOutcomeChip } from './audit-outcome-chip'

interface AuditLogRowProps {
  row: AuditLogRecord
  onOpen: (row: AuditLogRecord) => void
}

/**
 * Строка журнала. Кликабельна целиком (и с клавиатуры — Enter): открывает карточку события.
 * Пустые ячейки — «—»: у событий сеанса нет объекта, у записей до SCRUM-371 — адресов и сеанса.
 */
export const AuditLogRow = ({ row, onOpen }: AuditLogRowProps) => (
  <TableRow
    hover
    tabIndex={0}
    onClick={() => {
      onOpen(row)
    }}
    onKeyDown={(event) => {
      // Только когда фокус на самой строке: Enter на ссылке объекта — это переход в объект.
      if (event.key === 'Enter' && event.target === event.currentTarget) {
        onOpen(row)
      }
    }}
    sx={{ cursor: 'pointer', verticalAlign: 'top' }}
  >
    <TableCell
      className="whitespace-nowrap"
      sx={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {formatOccurredAt(row.occurredAt)}
    </TableCell>
    <TableCell>
      {userDisplay(row)}
      {/* Логин — подписью под ФИО; без ФИО он уже и есть основной текст. */}
      {row.userName && row.userLogin && row.userLogin !== row.userName && (
        <Typography variant="caption" color="text.secondary" display="block">
          {row.userLogin}
        </Typography>
      )}
    </TableCell>
    <TableCell>{computerDisplay(row)}</TableCell>
    <TableCell>
      {/* userAgent — подсказкой: полная строка браузера нужна разбору, а не глазу. */}
      <span title={row.userAgent ?? undefined}>{applicationDisplay(row)}</span>
    </TableCell>
    <TableCell>{orDash(row.actionPresentation)}</TableCell>
    <TableCell>
      <AuditOutcomeChip
        outcome={row.outcome}
        presentation={row.outcomePresentation}
      />
    </TableCell>
    <TableCell>{metadataDisplay(row)}</TableCell>
    <TableCell>
      <AuditEntryLink record={row} />
    </TableCell>
    <TableCell className="whitespace-nowrap">
      {row.sessionId ? (
        <Tooltip title={row.sessionId}>
          <span>{shortId(row.sessionId)}</span>
        </Tooltip>
      ) : (
        '—'
      )}
    </TableCell>
    <TableCell>{orDash(row.serverNode)}</TableCell>
    <TableCell>
      <NetworkChainView hops={resolveNetworkChain(row)} />
    </TableCell>
    <TableCell sx={{ minWidth: 200 }}>
      <span className="line-clamp-3">{orDash(row.message)}</span>
    </TableCell>
  </TableRow>
)
