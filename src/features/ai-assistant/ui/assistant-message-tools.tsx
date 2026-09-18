import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import { Button, IconButton, Tooltip } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { showToast } from '@/shared/ui/toast/show-toast'

export function AssistantMessageTools({
  text,
  failedQuestion,
  onEditQuestion,
}: {
  text: string
  failedQuestion: string | null
  onEditQuestion?: (question: string) => void
}) {
  const { t } = useTranslation()
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      showToast('success', t('aiAssistant.copySuccess'))
    } catch {
      showToast('error', t('aiAssistant.copyFailed'))
    }
  }
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      <Tooltip title={t('aiAssistant.copyMessage')}>
        <IconButton
          size="small"
          aria-label={t('aiAssistant.copyMessage')}
          onClick={() => {
            void copy()
          }}
        >
          <ContentCopyOutlinedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
      {failedQuestion && onEditQuestion && (
        <Button
          size="small"
          onClick={() => {
            onEditQuestion(failedQuestion)
          }}
        >
          {t('aiAssistant.editFailedQuestion')}
        </Button>
      )}
    </div>
  )
}
