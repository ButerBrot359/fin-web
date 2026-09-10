import { useMemo } from 'react'
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material'
import { useAiConversationMessages } from '@/entities/ai-assistant'
import { AssistantMessageTimeline } from '@/features/ai-assistant'
import { restoreChatMessages } from '@/features/ai-assistant/lib/hooks/use-restored-assistant-session'
import { useAssistantHistoryScroll } from '@/features/ai-assistant/lib/hooks/use-assistant-history-scroll'
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
        overflowX: 'hidden',
        overflowAnchor: 'none',
        px: 1.5,
        pt: 1.5,
        pb: 1.5,
      }}
    >
      <div className="mx-auto flex w-full max-w-[860px] min-w-0 flex-col gap-3">
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
        <AssistantMessageTimeline
          messages={messages}
          language={language}
          disabled
          onOpenDocument={onOpenDocument}
        />
      </div>
    </Box>
  )
}
