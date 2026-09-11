import { Box, Chip, Stack, Typography } from '@mui/material'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import { useTranslation } from 'react-i18next'

import { renderCellValue } from '../../../lib/utils/cell-value'

interface HistoryAi {
  tool?: string
  toolLabel?: string
  initiatedBy?: { userId?: number; login?: string; name?: string }
  attribution?: 'EVENT' | 'CREATION_FLAG'
  executionId?: string
  stepId?: string
  taskId?: string
}
interface HistoryChange {
  field: string
  label: string
  before?: unknown
  after?: unknown
}
export interface AuditHistoryRow {
  [key: string]: unknown
  origin?: 'AI' | 'USER' | 'UNKNOWN'
  ai?: HistoryAi
  changesDetails?: HistoryChange[]
}

const shown = (value: unknown) => renderCellValue(value).trim() || '—'

/** Receiver for TABLE binding=history; old server rows keep their text fallback. */
export function AuditHistoryCell({
  row,
  binding,
}: {
  row: AuditHistoryRow
  binding: string
}) {
  const { t } = useTranslation()
  const value = renderCellValue(row[binding])
  const ai = row.origin === 'AI' ? row.ai : undefined

  if (binding === 'originLabel' && row.origin) {
    const isAi = row.origin === 'AI'
    return (
      <Chip
        size="small"
        variant="outlined"
        color={isAi ? 'primary' : 'default'}
        icon={isAi ? <AutoAwesomeOutlinedIcon /> : undefined}
        label={isAi ? t('documentHistory.withAi') : value}
        title={t(
          row.origin === 'UNKNOWN'
            ? 'documentHistory.unknownHint'
            : isAi
              ? 'documentHistory.aiHint'
              : 'documentHistory.manualHint'
        )}
        sx={{
          height: 'auto',
          minHeight: 26,
          '& .MuiChip-label': { whiteSpace: 'normal', py: 0.25 },
        }}
      />
    )
  }
  if (binding === 'occurredAt') {
    const parts = /^(\d{2}\.\d{2}\.\d{4}) (\d{2}:\d{2}:\d{2})$/.exec(value)
    return parts ? (
      <Box sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
        <div>{parts[1]}</div>
        <Typography variant="body2" color="text.secondary">
          {parts[2]}
        </Typography>
      </Box>
    ) : (
      <>{value}</>
    )
  }
  if (binding === 'outcome' && row.outcomeCode) {
    const color =
      row.outcomeCode === 'SUCCESS'
        ? 'success'
        : row.outcomeCode === 'FAILED'
          ? 'error'
          : 'warning'
    return <Chip size="small" variant="outlined" color={color} label={value} />
  }
  if (binding === 'action')
    return (
      <Stack spacing={0.5}>
        <span>{value}</span>
        {ai?.toolLabel && (
          <Typography variant="caption" color="text.secondary">
            {ai.toolLabel}
          </Typography>
        )}
      </Stack>
    )
  if (binding === 'userName' && ai?.initiatedBy) {
    const { name, login } = ai.initiatedBy
    return (
      <Stack spacing={0.25}>
        <span>{name || login || value || '—'}</span>
        <Typography variant="caption" color="text.secondary">
          {t('documentHistory.initiator')}
        </Typography>
        {login && login !== name && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ overflowWrap: 'anywhere' }}
          >
            {login}
          </Typography>
        )}
      </Stack>
    )
  }
  if (
    binding === 'changes' &&
    Array.isArray(row.changesDetails) &&
    row.changesDetails.length
  ) {
    return (
      <Stack spacing={1}>
        {row.changesDetails.map((change, index) => (
          <Box key={`${change.field}-${String(index)}`}>
            <Typography variant="body2" fontWeight={600}>
              {change.label}
            </Typography>
            <Typography
              variant="body2"
              sx={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}
            >
              <Box component="span" sx={{ color: 'text.secondary' }}>
                {shown(change.before)}
              </Box>
              {' → '}
              {shown(change.after)}
            </Typography>
          </Box>
        ))}
      </Stack>
    )
  }
  if (binding === 'message' && ai)
    return (
      <Stack spacing={1}>
        {value && <span>{value}</span>}
        <HistoryAiDetails ai={ai} />
      </Stack>
    )
  return <>{value}</>
}

function HistoryAiDetails({ ai }: { ai: HistoryAi }) {
  const { t } = useTranslation()
  const trace = (
    [
      ['execution', ai.executionId],
      ['step', ai.stepId],
      ['task', ai.taskId],
    ] as const
  ).filter(([, value]) => value)
  return (
    <Box
      component="details"
      sx={{
        fontSize: 13,
        '& summary': { cursor: 'pointer', color: 'primary.main' },
      }}
    >
      <summary>{t('documentHistory.details')}</summary>
      <Stack spacing={1} sx={{ pt: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {t(
            ai.attribution === 'CREATION_FLAG'
              ? 'documentHistory.creationHint'
              : 'documentHistory.eventHint'
          )}
        </Typography>
        {trace.map(([key, value]) => (
          <Box key={key}>
            <Typography variant="caption" color="text.secondary">
              {t(`documentHistory.${key}`)}
            </Typography>
            <Box sx={{ overflowWrap: 'anywhere', userSelect: 'text' }}>
              {value}
            </Box>
          </Box>
        ))}
      </Stack>
    </Box>
  )
}
