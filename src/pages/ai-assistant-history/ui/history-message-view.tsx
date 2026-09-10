import { Fragment, useMemo } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from '@mui/material'
import { useAiConversationMessages } from '@/entities/ai-assistant'
import { AssistantAnswerCard } from '@/features/ai-assistant/ui/assistant-answer-card'
import { restoreChatMessages } from '@/features/ai-assistant/lib/hooks/use-restored-assistant-session'
import { useAssistantHistoryScroll } from '@/features/ai-assistant/lib/hooks/use-assistant-history-scroll'
import { buildAssistantMessageTimeline } from '@/features/ai-assistant/lib/message-time'
import type { HistoryCopy } from '../lib/history-copy'

export function HistoryMessageView({
  conversationId,
  copy,
  language,
  onOpenDocument,
}: {
  conversationId: number
  copy: HistoryCopy
  language: string
  onOpenDocument: (typeCode: string, id: number) => void
}) {
  const history = useAiConversationMessages(conversationId, true, true)
  const messages = useMemo(
    () => restoreChatMessages(history.messages),
    [history.messages]
  )
  const ids = useMemo(() => messages.map((message) => message.id), [messages])
  const { scrollRef, onScroll, loadOlder } = useAssistantHistoryScroll({
    active: true,
    messageIds: ids,
    isPending: false,
    hasOlderMessages: history.hasOlderMessages,
    isLoadingOlder: history.isLoadingOlder,
    olderMessagesError: history.olderMessagesError,
    onLoadOlder: history.loadOlder,
  })
  return (
    <Box
      ref={scrollRef}
      onScroll={onScroll}
      data-testid="history-messages"
      sx={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        overflowAnchor: 'none',
        px: { xs: 1, md: 4 },
        py: 3,
        pb: { xs: 14, md: 3 },
      }}
    >
      <Stack spacing={2.5} sx={{ maxWidth: 860, mx: 'auto' }}>
        {history.isLoading && (
          <Box textAlign="center">
            <CircularProgress size={24} aria-label={copy.loading} />
          </Box>
        )}
        {history.isError && !history.olderMessagesError && (
          <Alert
            severity="error"
            action={<Button onClick={history.retry}>{copy.retry}</Button>}
          >
            {copy.failed}
          </Alert>
        )}
        {history.hasOlderMessages && (
          <Box textAlign="center">
            <Button
              size="small"
              disabled={history.isLoadingOlder}
              onClick={loadOlder}
            >
              {history.isLoadingOlder
                ? copy.loading
                : history.olderMessagesError
                  ? copy.retry
                  : copy.earlier}
            </Button>
          </Box>
        )}
        {history.olderMessagesError && (
          <Typography color="error" textAlign="center" variant="body2">
            {copy.failed}
          </Typography>
        )}
        {history.isSuccess && !messages.length && (
          <Typography textAlign="center" color="text.secondary">
            {copy.noMessages}
          </Typography>
        )}
        {buildAssistantMessageTimeline(messages, language).map(
          ({ message, timestamp, startsDay }) => (
            <Fragment key={message.id}>
              {startsDay && (
                <Divider sx={{ mb: 3, color: 'text.secondary', fontSize: 12 }}>
                  {timestamp?.dayLabel}
                </Divider>
              )}
              <Box
                data-assistant-message-id={message.id}
                sx={{
                  minWidth: 0,
                  ml: message.role === 'USER' ? { xs: 0, sm: 10 } : 0,
                  mr: message.role === 'ASSISTANT' ? { xs: 0, sm: 4 } : 0,
                }}
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  mb={0.75}
                  gap={1}
                >
                  <Typography variant="caption" fontWeight={600}>
                    {message.role === 'USER' ? copy.user : copy.assistant}
                  </Typography>
                  {timestamp ? (
                    <Typography
                      component="time"
                      dateTime={timestamp.dateTime}
                      title={timestamp.title}
                      variant="caption"
                      color="text.secondary"
                    >
                      {timestamp.time}
                    </Typography>
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      {copy.unknownTime}
                    </Typography>
                  )}
                </Stack>
                {message.answer ? (
                  <AssistantAnswerCard
                    answer={message.answer}
                    disabled
                    onAction={() => undefined}
                    onOpenDocument={onOpenDocument}
                  />
                ) : (
                  <Box
                    sx={{
                      p: { xs: 1.5, sm: 2 },
                      borderRadius: 3,
                      bgcolor:
                        message.role === 'USER'
                          ? 'action.selected'
                          : 'action.hover',
                      overflowWrap: 'anywhere',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    <Typography variant="body2">{message.text}</Typography>
                  </Box>
                )}
                {message.error && (
                  <Alert
                    severity="error"
                    sx={{ mt: 1, overflowWrap: 'anywhere' }}
                  >
                    {message.error}
                  </Alert>
                )}
              </Box>
            </Fragment>
          )
        )}
      </Stack>
    </Box>
  )
}
