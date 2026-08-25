import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Paper, Typography } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'

/**
 * Ошибка загрузки deferred-ноды (SCRUM-384 §3.4): текст с бэка (setProp error)
 * либо локальный транспортный, кнопка «Повторить» шлёт HYDRATE этой ноды
 * заново — `deferred` при ошибке не снимается, повтор честный. Остальная
 * страница остаётся полностью функциональной.
 */
export const DeferredErrorState: FC<{
  label?: string
  message: string
  onRetry: () => void
}> = ({ label, message, onRetry }) => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <Typography variant="subtitle1" fontWeight={600}>
          {label}
        </Typography>
      )}
      <Paper
        variant="outlined"
        className="flex flex-col items-center gap-2 p-6"
      >
        <Typography color="error" variant="body2">
          {message}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={onRetry}
        >
          {t('sdui.deferred.retry')}
        </Button>
      </Paper>
    </div>
  )
}
