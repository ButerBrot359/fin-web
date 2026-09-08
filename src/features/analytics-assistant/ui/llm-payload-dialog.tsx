import { useTranslation } from 'react-i18next'
import { Dialog, Typography } from '@mui/material'

import { useLlmRequest } from '@/entities/analytics'
import CrossIcon from '@/shared/assets/icons/cross.svg'
import { ShimmerBlock } from '@/shared/ui/shimmer-block'

import { LlmPayloadBlock } from './llm-payload-block'
import { LlmPayloadMeta } from './llm-payload-meta'

interface LlmPayloadDialogProps {
  open: boolean
  llmRequestId: number | null
  onClose: () => void
}

/**
 * Панель «Что ушло в ИИ» — доказательство того, что в модель уходит только
 * структура данных: имена витрин, колонок и типы. Строки таблиц сюда не
 * попадают никогда, и пользователь может это проверить сам.
 *
 * Поэтому обещание вынесено наверх плашкой, а дальше идут разделы под
 * микро-лейблами: системная инструкция, запрос, ответ модели.
 */
export const LlmPayloadDialog = ({
  open,
  llmRequestId,
  onClose,
}: LlmPayloadDialogProps) => {
  const { t } = useTranslation()
  const { request, isLoading } = useLlmRequest(llmRequestId ?? undefined, open)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: '16px' } } }}
    >
      <div className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto p-6">
        <div className="flex items-start gap-4">
          <Typography
            component="h2"
            className="flex-1 text-[20px] font-bold tracking-[-0.01em] text-ui-06"
          >
            {t('analytics.assistant.whatWasSentTitle')}
          </Typography>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('actions.close')}
            className="shrink-0 cursor-pointer"
          >
            <CrossIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="rounded-lg border-l-2 border-accent-02 bg-ui-02 px-3 py-2.5">
          <Typography variant="body2" className="text-ui-06">
            {t('analytics.assistant.whatWasSentHint')}
          </Typography>
        </div>

        {isLoading && (
          <div className="flex flex-col gap-2">
            <ShimmerBlock className="h-4 w-1/3" />
            <ShimmerBlock className="h-24 w-full" />
            <ShimmerBlock className="h-24 w-full" />
          </div>
        )}

        {!isLoading && request && (
          <>
            <LlmPayloadMeta request={request} />

            {request.errorMessage && (
              <Typography variant="body2" className="text-support-01">
                {request.errorMessage}
              </Typography>
            )}

            <LlmPayloadBlock
              label={t('analytics.assistant.systemPrompt')}
              text={request.systemPrompt}
            />
            <LlmPayloadBlock
              label={t('analytics.assistant.userPrompt')}
              text={request.userPrompt}
            />
            <LlmPayloadBlock
              label={t('analytics.assistant.response')}
              text={request.responseText}
            />
          </>
        )}
      </div>
    </Dialog>
  )
}
