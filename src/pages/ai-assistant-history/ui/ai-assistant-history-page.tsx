import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  List,
  ListItemButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import ChatBubbleOutlineRounded from '@mui/icons-material/ChatBubbleOutlineRounded'
import { useAiConversationPages } from '@/entities/ai-assistant'
import { formatAssistantMessageTime } from '@/features/ai-assistant/lib/message-time'
import { useTabMeta, useWorkspaceTabsStore } from '@/features/workspace-tabs'
import { PageHeader } from '@/widgets/page-header'
import { historyCopy } from '../lib/history-copy'
import { HistoryMessageView } from './history-message-view'

export function AiAssistantHistoryPage() {
  const { i18n } = useTranslation()
  const copy = historyCopy(i18n.language)
  const history = useAiConversationPages()
  const navigate = useNavigate()
  const location = useLocation()
  const { pageCode } = useParams()
  const [params, setParams] = useSearchParams()
  const rawId = params.get('conversationId')
  const numericId = rawId && /^\d+$/.test(rawId) ? Number(rawId) : null
  const selectedId =
    numericId != null && Number.isSafeInteger(numericId) && numericId > 0
      ? numericId
      : null
  const selected = history.conversations.find(
    (conversation) => conversation.id === selectedId
  )
  const requestInFlight = useRef(false)
  useTabMeta(copy.title)
  useEffect(() => {
    if (!history.isLoadingMore) requestInFlight.current = false
  }, [history.isLoadingMore])
  const loadMore = () => {
    if (!history.hasMore || history.isFetching || requestInFlight.current)
      return
    requestInFlight.current = true
    history.loadMore()
  }
  const select = (id: number | null) => {
    const next = new URLSearchParams(params)
    if (id == null) next.delete('conversationId')
    else next.set('conversationId', String(id))
    setParams(next)
  }
  return (
    <Box
      sx={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        pt: 2.5,
        gap: { xs: 1, md: 2 },
      }}
    >
      <Typography
        variant="h6"
        fontWeight={650}
        sx={{ display: { xs: 'block', md: 'none' }, px: 1 }}
      >
        {copy.shortTitle}
      </Typography>
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <PageHeader
          title={copy.title}
          onClose={() => {
            useWorkspaceTabsStore.getState().closeTab(location.pathname)
            void navigate('/')
          }}
        />
      </Box>
      <Paper
        variant="outlined"
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          overflow: 'hidden',
          borderRadius: 3,
          mb: 2,
        }}
      >
        <Box
          sx={{
            width: { xs: '100%', md: 310 },
            flexShrink: 0,
            minHeight: 0,
            display: { xs: selectedId ? 'none' : 'flex', md: 'flex' },
            flexDirection: 'column',
            borderRight: { md: '1px solid' },
            borderColor: { md: 'divider' },
            bgcolor: 'action.hover',
          }}
        >
          <Box p={2.5}>
            <Typography fontWeight={650}>{copy.chats}</Typography>
            <Typography variant="caption" color="text.secondary">
              {copy.subtitle}
            </Typography>
          </Box>
          <Box
            data-testid="history-conversations"
            sx={{ overflowY: 'auto', flex: 1, minHeight: 0 }}
            onScroll={(event) => {
              const target = event.currentTarget
              if (
                target.scrollHeight - target.scrollTop - target.clientHeight <
                  100 &&
                !history.isError
              )
                loadMore()
            }}
          >
            <List disablePadding sx={{ px: 1 }}>
              {history.conversations.map((conversation) => {
                const time = formatAssistantMessageTime(
                  conversation.createdAt,
                  i18n.language
                )
                return (
                  <ListItemButton
                    key={conversation.id}
                    selected={selectedId === conversation.id}
                    onClick={() => {
                      select(conversation.id)
                    }}
                    sx={{
                      borderRadius: 2,
                      mb: 0.5,
                      alignItems: 'flex-start',
                      gap: 1.5,
                      py: 1.5,
                    }}
                  >
                    <ChatBubbleOutlineRounded
                      sx={{ fontSize: 18, mt: 0.25, color: 'text.secondary' }}
                    />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        fontWeight={selectedId === conversation.id ? 650 : 500}
                        sx={{
                          overflowWrap: 'anywhere',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {conversation.title || copy.untitled}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        title={time?.title}
                      >
                        {time
                          ? `${time.dayLabel} · ${time.time}`
                          : copy.unknownTime}
                      </Typography>
                    </Box>
                  </ListItemButton>
                )
              })}
            </List>
            {history.isLoading && (
              <Box p={3} textAlign="center">
                <CircularProgress size={24} aria-label={copy.loading} />
              </Box>
            )}
            {history.isError && (
              <Alert
                severity="error"
                sx={{ m: 1 }}
                action={<Button onClick={history.retry}>{copy.retry}</Button>}
              >
                {copy.failed}
              </Alert>
            )}
            {!history.isLoading &&
              !history.isError &&
              history.conversations.length === 0 && (
                <Box p={3}>
                  <Typography fontWeight={600}>{copy.empty}</Typography>
                  <Typography variant="body2" color="text.secondary" mt={1}>
                    {copy.emptyHint}
                  </Typography>
                </Box>
              )}
            {history.hasMore && (
              <Box p={2} textAlign="center">
                <Button onClick={loadMore} disabled={history.isLoadingMore}>
                  {history.isLoadingMore ? copy.loading : copy.more}
                </Button>
              </Box>
            )}
          </Box>
        </Box>
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: { xs: selectedId ? 'flex' : 'none', md: 'flex' },
            flexDirection: 'column',
          }}
        >
          {selectedId ? (
            <>
              <Stack
                direction="row"
                alignItems="center"
                gap={1}
                sx={{
                  p: { xs: 1, sm: 2 },
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <IconButton
                  aria-label={copy.back}
                  onClick={() => {
                    select(null)
                  }}
                  sx={{ display: { md: 'none' } }}
                >
                  <ArrowBackRounded />
                </IconButton>
                <Box minWidth={0}>
                  <Typography fontWeight={650} noWrap>
                    {selected?.title || copy.conversation}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {copy.readOnly}
                  </Typography>
                </Box>
              </Stack>
              <HistoryMessageView
                key={selectedId}
                conversationId={selectedId}
                copy={copy}
                language={i18n.language}
                onOpenDocument={(typeCode, id) => {
                  if (Number.isSafeInteger(id) && id > 0)
                    void navigate(
                      `/modules/${encodeURIComponent(pageCode ?? 'Analitika')}/document/${encodeURIComponent(typeCode)}/${String(id)}`
                    )
                }}
              />
            </>
          ) : (
            <Box
              sx={{
                flex: 1,
                display: 'grid',
                placeContent: 'center',
                textAlign: 'center',
                p: 4,
              }}
            >
              <ChatBubbleOutlineRounded
                sx={{ fontSize: 40, color: 'text.disabled', mx: 'auto', mb: 2 }}
              />
              <Typography variant="h6">{copy.choose}</Typography>
              <Typography color="text.secondary" variant="body2" mt={1}>
                {copy.chooseHint}
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  )
}
