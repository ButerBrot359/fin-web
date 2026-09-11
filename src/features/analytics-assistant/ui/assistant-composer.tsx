import { useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { Box, Button, TextField, Typography } from '@mui/material'
import type { AnalyticsItemKind } from '@/entities/analytics'
import { useAnalyticsWorkspaceCopy } from '../lib/workspace-copy'
interface AssistantComposerProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  kind: AnalyticsItemKind
  isPending: boolean
}
export const AssistantComposer = ({
  value,
  onChange,
  onSubmit,
  kind,
  isPending,
}: AssistantComposerProps) => {
  const copy = useAnalyticsWorkspaceCopy(kind)
  const composing = useRef(false)
  const canSend = !!value.trim() && !isPending
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      event.key !== 'Enter' ||
      event.shiftKey ||
      event.nativeEvent.isComposing ||
      composing.current
    )
      return
    event.preventDefault()
    if (canSend) onSubmit()
  }
  return (
    <Box
      sx={{
        flexShrink: 0,
        p: 2,
        borderTop: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <TextField
        fullWidth
        multiline
        minRows={2}
        maxRows={6}
        value={value}
        disabled={isPending}
        placeholder={copy.placeholder}
        onChange={(event) => { onChange(event.target.value); }}
        onKeyDown={keyDown}
        onCompositionStart={() => {
          composing.current = true
        }}
        onCompositionEnd={() => {
          composing.current = false
        }}
        slotProps={{
          htmlInput: {
            'aria-label': copy.placeholder,
            'data-testid': 'analytics-composer-input',
          },
        }}
      />
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          mt: 1,
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontSize: 11 }}
        >
          {copy.keyHint}
        </Typography>
        <Button
          variant="contained"
          disabled={!canSend}
          onClick={onSubmit}
          sx={{ flexShrink: 0 }}
        >
          {copy.send} ↑
        </Button>
      </Box>
    </Box>
  )
}
