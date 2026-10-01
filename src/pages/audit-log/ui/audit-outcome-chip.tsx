import { Chip } from '@mui/material'

interface AuditOutcomeChipProps {
  outcome: string
  presentation: string
}

/**
 * Статус события: «Выполнено» — зелёный, «Ошибка» — красный, «Отклонено» — жёлтый. Подпись —
 * серверная (`outcomePresentation`), цвет — по коду: проверяющий ищет глазами именно отказы.
 */
export const AuditOutcomeChip = ({
  outcome,
  presentation,
}: AuditOutcomeChipProps) => {
  const color =
    outcome === 'SUCCESS'
      ? 'success'
      : outcome === 'FAILED'
        ? 'error'
        : outcome === 'DENIED'
          ? 'warning'
          : 'default'
  return (
    <Chip
      size="small"
      variant="outlined"
      color={color}
      label={presentation || outcome || '—'}
    />
  )
}
