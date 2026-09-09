import { useTranslation } from 'react-i18next'
import { MenuItem, TextField, Typography } from '@mui/material'

import { useAiConnections } from '@/entities/ai-connection'

interface ConnectionSelectProps {
  value: number | null
  onChange: (connectionId: number | null) => void
}

/**
 * Выбор подключения для контура.
 *
 * <p>Только выбор: провайдер, ключ и модель описаны в реестре выше. Здесь их нет
 * намеренно — два места, где хранится одно и то же, и были той проблемой, ради
 * которой реестр заводился.
 */
export const ConnectionSelect = ({
  value,
  onChange,
}: ConnectionSelectProps) => {
  const { t } = useTranslation()
  const { connections } = useAiConnections()

  if (connections.length === 0) {
    return (
      <Typography variant="body2" className="text-ui-05">
        {t('aiConnections.emptyForSurface')}
      </Typography>
    )
  }

  return (
    <TextField
      select
      label={t('aiConnections.selectLabel')}
      value={value == null ? '' : String(value)}
      onChange={(event) => {
        onChange(event.target.value === '' ? null : Number(event.target.value))
      }}
    >
      <MenuItem value="">{t('aiConnections.notSelected')}</MenuItem>
      {connections.map((connection) => (
        <MenuItem key={connection.id} value={String(connection.id)}>
          {`${connection.name} — ${connection.model}`}
        </MenuItem>
      ))}
    </TextField>
  )
}
