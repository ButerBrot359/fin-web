import { useEffect, useState } from 'react'
import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

export function AssistantPendingStatus({ startedAt }: { startedAt: number }) {
  const { t } = useTranslation()
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => {
      window.clearInterval(timer)
    }
  }, [])
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000))
  return (
    <div className="rounded-lg bg-ui-02 px-3 py-2">
      <Typography variant="body2" role="status" className="text-ui-05">
        {t('aiAssistant.thinking')}
        <span aria-hidden="true">
          {' '}
          · {t('aiAssistant.waitSeconds', { count: seconds })}
        </span>
      </Typography>
      <Typography variant="caption" className="text-ui-05">
        {t('aiAssistant.canMinimize')}
      </Typography>
    </div>
  )
}
