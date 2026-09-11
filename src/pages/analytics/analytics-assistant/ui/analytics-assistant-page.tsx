import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import {
  AssistantChat,
  AssistantComposer,
  LlmPayloadDialog,
  SaveItemDialog,
  useAssistantSession,
} from '@/features/analytics-assistant'
import { useAnalyticsWorkspaceCopy } from '@/features/analytics-assistant/lib/workspace-copy'
import type { SaveItemValues } from '@/features/analytics-assistant'
import type { AnalyticsItemKind } from '@/entities/analytics'
import { useTabMeta } from '@/features/workspace-tabs'
import { useSaveCurrentSpec } from '../lib/hooks/use-save-current-spec'
import { AssistantPreview } from './assistant-preview'

export const AnalyticsAssistantPage = ({
  kind = 'DASHBOARD',
}: {
  kind?: AnalyticsItemKind
}) => {
  const copy = useAnalyticsWorkspaceCopy(kind)
  const navigate = useNavigate()
  const { pageCode } = useParams()
  useTabMeta(copy.title)
  const session = useAssistantSession(kind)
  const [prompt, setPrompt] = useState('')
  const [payloadId, setPayloadId] = useState<number | null>(null)
  const [isSaveOpen, setIsSaveOpen] = useState(false)
  const [mobileTab, setMobileTab] = useState<'chat' | 'result'>('chat')
  const [expanded, setExpanded] = useState(false)
  const lastPrompt =
    [...session.messages].reverse().find((message) => message.role === 'USER')
      ?.text ?? null
  const { save, isPending: isSaving } = useSaveCurrentSpec(
    session.currentSpec,
    lastPrompt
  )
  const base = pageCode ? `/modules/${pageCode}/analytics` : '/analytics'
  const busy = session.isPending || session.isRestoring
  const canSave = session.currentSpec?.kind === kind && !busy && !isSaving
  const send = (text: string) => {
    if (!busy && !session.restoreError) {
      session.send(text)
      setPrompt('')
    }
  }
  const handleSave = (values: SaveItemValues) => {
    if (canSave)
      save(values, () => {
        setIsSaveOpen(false)
      })
  }
  return (
    <Box
      data-testid="analytics-assistant-workspace"
      sx={{
        height: 'calc(100dvh - 150px)',
        minHeight: 360,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        pt: 2,
        minWidth: 0,
        width: '100%',
        mx: 0,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        <Box sx={{ minWidth: 0, width: { xs: '100%', md: 'auto' } }}>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 700,
              fontSize: { xs: 19, md: 25 },
              whiteSpace: 'normal',
              overflowWrap: 'anywhere',
              lineHeight: 1.35,
            }}
          >
            <Box
              component="span"
              sx={{ display: { xs: 'none', md: 'inline' } }}
            >
              {copy.title}
            </Box>
            <Box
              component="span"
              sx={{ display: { xs: 'inline', md: 'none' } }}
            >
              {kind === 'REPORT' ? copy.shortReport : copy.shortDashboard}
            </Box>
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.5, display: { xs: 'none', md: 'block' } }}
          >
            {copy.hint}
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'flex',
            gap: { xs: 0.5, md: 1 },
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <Button
            size="small"
            aria-label={copy.back}
            onClick={() => {
              void navigate(`${base}/assistant`)
            }}
          >
            <Box
              component="span"
              sx={{ display: { xs: 'none', md: 'inline' } }}
            >
              {copy.back}
            </Box>
            <Box
              component="span"
              sx={{ display: { xs: 'inline', md: 'none' } }}
            >
              {copy.shortBack}
            </Box>
          </Button>
          <Button
            size="small"
            variant="outlined"
            aria-label={copy.newChat}
            disabled={
              busy || (session.messages.length === 0 && !session.restoreError)
            }
            onClick={() => {
              session.reset()
              setPrompt('')
              setMobileTab('chat')
            }}
          >
            <Box
              component="span"
              sx={{ display: { xs: 'none', md: 'inline' } }}
            >
              {copy.newChat}
            </Box>
            <Box
              component="span"
              sx={{ display: { xs: 'inline', md: 'none' } }}
            >
              {copy.shortNew}
            </Box>
          </Button>
          <Button
            size="small"
            variant="contained"
            disabled={!canSave}
            sx={{
              display: {
                xs: session.currentSpec ? 'inline-flex' : 'none',
                md: 'inline-flex',
              },
            }}
            onClick={() => {
              setIsSaveOpen(true)
            }}
          >
            {copy.save}
          </Button>
        </Box>
      </Box>
      <Tabs
        value={mobileTab}
        onChange={(_, value: 'chat' | 'result') => {
          setMobileTab(value)
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          flexShrink: 0,
          minHeight: 40,
        }}
        variant="fullWidth"
      >
        <Tab
          value="chat"
          label={copy.chat}
          data-testid="analytics-mobile-chat"
        />
        <Tab
          value="result"
          label={copy.result}
          data-testid="analytics-mobile-result"
        />
      </Tabs>
      <Box sx={{ display: 'flex', gap: 2, flex: 1, minHeight: 0 }}>
        <Paper
          variant="outlined"
          sx={{
            display: {
              xs: mobileTab === 'chat' ? 'flex' : 'none',
              md: expanded ? 'none' : 'flex',
            },
            flexDirection: 'column',
            flex: { xs: 1, md: session.currentSpec ? '1 1 52%' : '1 1 65%' },
            minWidth: 0,
            minHeight: 0,
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 1.25,
              borderBottom: 1,
              borderColor: 'divider',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography fontWeight={600}>{copy.chat}</Typography>
            <Chip
              size="small"
              label={kind === 'REPORT' ? copy.reportTitle : copy.dashboardTitle}
              variant="outlined"
            />
          </Box>
          {session.isRestoring && <Alert severity="info">{copy.restore}</Alert>}
          {session.restoreError && (
            <Alert
              severity="error"
              action={
                <Button size="small" onClick={session.retryRestore}>
                  {copy.retry}
                </Button>
              }
            >
              {copy.restoreError}
            </Alert>
          )}
          <AssistantChat
            kind={kind}
            messages={session.messages}
            isPending={session.isPending}
            settingsPath={`${base}/settings`}
            onExampleClick={setPrompt}
            onReply={send}
            onShowPayload={setPayloadId}
          />
          <AssistantComposer
            value={prompt}
            onChange={setPrompt}
            onSubmit={() => {
              send(prompt)
            }}
            kind={kind}
            isPending={busy || !!session.restoreError}
          />
        </Paper>
        <Paper
          variant="outlined"
          data-testid="analytics-result-panel"
          sx={{
            display: {
              xs: mobileTab === 'result' ? 'flex' : 'none',
              md: 'flex',
            },
            flexDirection: 'column',
            flex: { xs: 1, md: expanded ? '1 1 100%' : '1 1 48%' },
            minWidth: 0,
            minHeight: 0,
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 2,
              py: 1.25,
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Typography fontWeight={600}>{copy.result}</Typography>
            <Button
              size="small"
              sx={{ display: { xs: 'none', md: 'inline-flex' } }}
              onClick={() => {
                setExpanded(!expanded)
              }}
            >
              {expanded ? copy.collapse : copy.expand}
            </Button>
          </Box>
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              p: 2,
              bgcolor: 'action.hover',
            }}
          >
            {session.currentSpec ? (
              <AssistantPreview
                spec={session.currentSpec}
                isPending={session.isPending}
              />
            ) : (
              <Box
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  p: 3,
                  gap: 1.5,
                }}
              >
                <Typography sx={{ fontSize: 38, opacity: 0.35 }} aria-hidden>
                  {kind === 'REPORT' ? '▤' : '▥'}
                </Typography>
                <Typography fontWeight={600}>{copy.previewEmpty}</Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ maxWidth: 360, lineHeight: 1.8 }}
                >
                  {copy.previewHint}
                </Typography>
              </Box>
            )}
            {session.currentSpec && session.messages.at(-1)?.error && (
              <Alert severity="info" sx={{ mt: 2 }}>
                {copy.preserved}
              </Alert>
            )}
          </Box>
        </Paper>
      </Box>
      <LlmPayloadDialog
        open={payloadId != null}
        llmRequestId={payloadId}
        onClose={() => {
          setPayloadId(null)
        }}
      />
      <SaveItemDialog
        open={isSaveOpen}
        defaultTitle={session.currentSpec?.title ?? ''}
        isPending={isSaving || busy}
        onClose={() => {
          setIsSaveOpen(false)
        }}
        onSave={handleSave}
      />
    </Box>
  )
}
