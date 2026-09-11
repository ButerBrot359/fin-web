import { Box, Button, Typography } from '@mui/material'
import type { AnalyticsItemKind } from '@/entities/analytics'
import { useAnalyticsWorkspaceCopy } from '../lib/workspace-copy'
export const AssistantEmptyState = ({
  kind = 'DASHBOARD',
  onExampleClick,
}: {
  kind?: AnalyticsItemKind
  onExampleClick: (text: string) => void
}) => {
  const copy = useAnalyticsWorkspaceCopy(kind)
  return (
    <Box sx={{ py: { xs: 2, md: 4 }, px: { xs: 0, md: 1 } }}>
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: 3,
          bgcolor: 'action.selected',
          display: 'grid',
          placeItems: 'center',
          fontSize: 25,
          mb: 2,
        }}
        aria-hidden
      >
        {kind === 'REPORT' ? '▤' : '▥'}
      </Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
        {copy.title}
      </Typography>
      <Typography
        color="text.secondary"
        sx={{ mb: 3, maxWidth: 550, lineHeight: 1.7 }}
      >
        {copy.friendly}
      </Typography>
      <Typography variant="overline" color="text.secondary">
        {copy.examples}
      </Typography>
      <Box sx={{ display: 'grid', gap: 1, mt: 1 }}>
        {copy.examplesList.map((text) => (
          <Button
            key={text}
            variant="outlined"
            onClick={() => { onExampleClick(text); }}
            sx={{
              justifyContent: 'space-between',
              textAlign: 'left',
              textTransform: 'none',
              px: 2,
              py: 1.5,
              borderColor: 'divider',
              color: 'text.primary',
              lineHeight: 1.6,
            }}
          >
            {text}
            <span aria-hidden>↗</span>
          </Button>
        ))}
      </Box>
    </Box>
  )
}
