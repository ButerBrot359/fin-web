import { useTranslation } from 'react-i18next'
import { Box, Button, Typography } from '@mui/material'
import { useAnalyticsWorkspaceCopy } from '../lib/workspace-copy'

import type { AssistantChatMessage } from '../lib/hooks/use-assistant-session'
import { AssistantErrorNote } from './assistant-error-note'
import { MicroLabel } from '@/shared/ui/micro-label'

interface AssistantResultCardProps {
  onReply?: (text: string) => void
  disabled?: boolean
  message: AssistantChatMessage
  settingsPath: string
  onShowPayload: (llmRequestId: number) => void
}

/** Глаз у кнопки «Что ушло в ИИ»: показать, а не рассказать. */
const EyeMark = () => (
  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
    <path
      d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
    <circle cx="8" cy="8" r="1.9" fill="currentColor" />
  </svg>
)

/**
 * Ответ ассистента — карточка результата, а не пузырь чата: заголовок
 * построенного представления, пояснение модели, источники данных и действия.
 *
 * «Что ушло в ИИ» — первоклассная кнопка: возможность своими глазами увидеть
 * отправленное в модель и есть то, чем этот продукт отличается от «чёрного
 * ящика», и выглядеть она должна соответственно.
 */
export const AssistantResultCard = ({
  message,
  settingsPath,
  onShowPayload,
  onReply,
  disabled = false,
}: AssistantResultCardProps) => {
  const { t } = useTranslation()
  const copy = useAnalyticsWorkspaceCopy()

  const { error, spec } = message
  const questionsSuffix =
    message.questions?.map((question) => question.text).join('\n') ?? ''
  const displayText =
    questionsSuffix && message.text.endsWith(questionsSuffix)
      ? message.text.slice(0, -questionsSuffix.length).trimEnd()
      : message.text
  const sourceViews = message.sourceViews ?? []
  const warnings = message.warnings ?? []
  const llmRequestId = message.llmRequestId ?? null
  const kindLabel =
    spec?.kind === 'REPORT'
      ? t('analytics.assistant.kindReport')
      : t('analytics.assistant.kindDashboard')
  const title = spec ? (spec.title ?? '') || kindLabel : ''

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-lg bg-ui-01 p-4 [overflow-wrap:anywhere]">
      {error != null && error !== '' && (
        <AssistantErrorNote text={error} settingsPath={settingsPath} />
      )}

      {title && (
        <div className="flex flex-col gap-1">
          <MicroLabel>{t('analytics.assistant.built')}</MicroLabel>
          <Typography
            component="h3"
            className="text-[17px] leading-6 font-bold tracking-[-0.01em] text-ui-06"
          >
            {title}
          </Typography>
        </div>
      )}

      {displayText && (
        <Typography variant="body2" className="whitespace-pre-wrap text-ui-06">
          {displayText}
        </Typography>
      )}

      {(message.questions?.length ?? 0) > 0 && (
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Typography variant="overline" color="primary">
            {copy.clarify}
          </Typography>
          {message.questions?.map((question) => (
            <Box key={question.id}>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                {question.text}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {question.options.map((option) => (
                  <Button
                    data-testid="analytics-clarification-option"
                    key={option}
                    disabled={disabled || !onReply}
                    variant="outlined"
                    size="small"
                    onClick={() => onReply?.(`${question.text}: ${option}`)}
                    sx={{
                      textTransform: 'none',
                      whiteSpace: 'normal',
                      textAlign: 'left',
                    }}
                  >
                    {option}
                  </Button>
                ))}
              </Box>
            </Box>
          ))}
        </Box>
      )}
      {(message.suggestions?.length ?? 0) > 0 && (
        <Box sx={{ display: 'grid', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {copy.suggestions}
          </Typography>
          {message.suggestions?.map((suggestion) => (
            <Button
              key={suggestion}
              disabled={disabled || !onReply}
              size="small"
              onClick={() => onReply?.(suggestion)}
              sx={{
                justifyContent: 'flex-start',
                textAlign: 'left',
                textTransform: 'none',
              }}
            >
              {suggestion} →
            </Button>
          ))}
        </Box>
      )}

      {sourceViews.length > 0 && (
        <details className="min-w-0">
          <summary className="cursor-pointer text-xs text-ui-05">
            {t('analytics.assistant.sourceViews')}
          </summary>
          <div className="flex flex-wrap gap-1.5">
            {sourceViews.map((view) => (
              <Typography
                key={view}
                component="span"
                className="rounded-md bg-ui-02 px-2 py-1 font-mono text-[11px] text-ui-06"
              >
                {view}
              </Typography>
            ))}
          </div>
        </details>
      )}

      {warnings.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-ui-03 pt-3">
          <MicroLabel>{t('analytics.assistant.warnings')}</MicroLabel>
          {warnings.map((warning) => (
            <Typography key={warning} variant="body2" className="text-ui-05">
              {warning}
            </Typography>
          ))}
        </div>
      )}

      {llmRequestId != null && (
        <div className="flex items-center gap-2 border-t border-ui-03 pt-3">
          <button
            type="button"
            onClick={() => {
              onShowPayload(llmRequestId)
            }}
            className="flex cursor-pointer items-center gap-2 rounded-md border border-accent-02 px-3 py-1.5 text-accent-02 transition-all hover:bg-ui-04 hover:shadow-secondary-hover active:bg-ui-08 active:shadow-none"
          >
            <EyeMark />
            <Typography
              component="span"
              variant="body2"
              className="font-semibold"
            >
              {t('analytics.assistant.whatWasSent')}
            </Typography>
          </button>
        </div>
      )}
    </div>
  )
}
