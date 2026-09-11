import { useLayoutEffect, useRef } from 'react'
import { Box, CircularProgress, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import type { AnalyticsItemKind } from '@/entities/analytics'
import type { AssistantChatMessage } from '../lib/hooks/use-assistant-session'
import { AssistantEmptyState } from './assistant-empty-state'
import { AssistantMessage } from './assistant-message'
interface AssistantChatProps {
  kind?: AnalyticsItemKind
  messages: AssistantChatMessage[]
  isPending: boolean
  settingsPath: string
  onExampleClick: (text: string) => void
  onShowPayload: (id: number) => void
  onReply?: (text: string) => void
}
export const AssistantChat = ({
  kind = 'DASHBOARD',
  messages,
  isPending,
  settingsPath,
  onExampleClick,
  onShowPayload,
  onReply,
}: AssistantChatProps) => {
  const { t } = useTranslation()
  const scroll = useRef<HTMLDivElement>(null)
  const nearBottom = useRef(true)
  useLayoutEffect(() => {
    if (scroll.current && nearBottom.current)
      scroll.current.scrollTop = scroll.current.scrollHeight
  }, [messages, isPending])
  return (
    <Box
      ref={scroll}
      data-testid="analytics-chat-scroll"
      onScroll={() => {
        const element = scroll.current
        if (element)
          nearBottom.current =
            element.scrollHeight - element.clientHeight - element.scrollTop <
            100
      }}
      sx={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        px: { xs: 2, md: 3 },
        py: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      {messages.length === 0 && !isPending && (
        <AssistantEmptyState kind={kind} onExampleClick={onExampleClick} />
      )}
      {messages.map((message) => (
        <AssistantMessage
          key={message.id}
          message={message}
          settingsPath={settingsPath}
          onShowPayload={onShowPayload}
          onReply={onReply}
          disabled={isPending}
        />
      ))}
      {isPending && (
        <Box
          role="status"
          sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 2 }}
        >
          <CircularProgress size={18} />
          <Typography variant="body2" color="text.secondary">
            {t('analytics.assistant.generating')}
          </Typography>
        </Box>
      )}
    </Box>
  )
}
