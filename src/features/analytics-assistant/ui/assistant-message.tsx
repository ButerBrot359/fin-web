import { Box, Typography } from '@mui/material'
import type { AssistantChatMessage } from '../lib/hooks/use-assistant-session'
import { AssistantResultCard } from './assistant-result-card'
import { formatDateTimeSeconds, formatTime } from '@/shared/lib/utils/date'
export const AssistantMessage = ({
  message,
  settingsPath,
  onShowPayload,
  onReply,
  disabled = false,
}: {
  message: AssistantChatMessage
  settingsPath: string
  onShowPayload: (id: number) => void
  onReply?: (text: string) => void
  disabled?: boolean
}) => {
  const date = message.createdAt ? new Date(message.createdAt) : null
  const valid = date != null && !Number.isNaN(date.getTime())
  return (
    <Box
      data-testid="analytics-chat-message"
      sx={{ minWidth: 0, flexShrink: 0 }}
    >
      {message.role === 'USER' ? (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Box
            sx={{
              maxWidth: '90%',
              px: 2,
              py: 1.5,
              bgcolor: 'action.selected',
              borderRadius: '16px 16px 4px 16px',
              overflowWrap: 'anywhere',
            }}
          >
            <Typography
              variant="body2"
              sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}
            >
              {message.text}
            </Typography>
          </Box>
        </Box>
      ) : (
        <AssistantResultCard
          message={message}
          settingsPath={settingsPath}
          onShowPayload={onShowPayload}
          onReply={onReply}
          disabled={disabled}
        />
      )}
      {valid && (
        <Typography
          component="time"
          dateTime={date.toISOString()}
          title={formatDateTimeSeconds(date)}
          variant="caption"
          color="text.secondary"
          sx={{
            display: 'block',
            mt: 0.5,
            textAlign: message.role === 'USER' ? 'right' : 'left',
            fontSize: 11,
          }}
        >
          {formatTime(date)}
        </Typography>
      )}
    </Box>
  )
}
