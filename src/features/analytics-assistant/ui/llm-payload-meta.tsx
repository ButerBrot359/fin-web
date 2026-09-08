import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import type { AnalyticsLlmRequest } from '@/entities/analytics'

import { MicroLabel } from '@/shared/ui/micro-label'

interface LlmPayloadMetaProps {
  request: AnalyticsLlmRequest
}

/**
 * Метаданные обращения одной строкой: провайдер, модель, токены, задержка.
 * Цифры табличные — токены и миллисекунды сравнивают между обращениями.
 */
export const LlmPayloadMeta = ({ request }: LlmPayloadMetaProps) => {
  const { t } = useTranslation()

  const items = [
    { label: t('analytics.assistant.provider'), value: request.provider },
    { label: t('analytics.settings.model'), value: request.model },
    {
      label: t('analytics.assistant.tokens'),
      value: `${String(request.inputTokens)} / ${String(request.outputTokens)}`,
    },
    {
      label: t('analytics.assistant.latency'),
      value: `${String(request.latencyMs)} ms`,
    },
  ]

  return (
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b border-ui-03 pb-4">
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline gap-2">
          <MicroLabel>{item.label}</MicroLabel>
          <Typography
            component="span"
            variant="body2"
            className="tabular-nums text-ui-06"
          >
            {item.value}
          </Typography>
        </div>
      ))}
    </div>
  )
}
