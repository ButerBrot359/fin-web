import { Box, Button, Paper, Typography } from '@mui/material'
import { useNavigate, useParams } from 'react-router-dom'
import { useTabMeta } from '@/features/workspace-tabs'
import { useAnalyticsWorkspaceCopy } from '@/features/analytics-assistant/lib/workspace-copy'
export function AnalyticsAssistantLanding() {
  const copy = useAnalyticsWorkspaceCopy()
  const { pageCode } = useParams()
  const navigate = useNavigate()
  useTabMeta(copy.landingTitle)
  const base = pageCode ? `/modules/${pageCode}/analytics` : '/analytics'
  return (
    <Box
      sx={{
        maxWidth: 1040,
        mx: 'auto',
        py: { xs: 3, md: 7 },
        px: { xs: 0, md: 3 },
      }}
    >
      <Typography variant="overline" color="primary">
        ИИ · AI
      </Typography>
      <Typography
        variant="h3"
        sx={{ fontSize: { xs: 28, md: 38 }, fontWeight: 750, mt: 1, mb: 2 }}
      >
        {copy.landingTitle}
      </Typography>
      <Typography
        color="text.secondary"
        sx={{ maxWidth: 680, lineHeight: 1.8, mb: 5 }}
      >
        {copy.landingHint}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 3,
        }}
      >
        {(['dashboard', 'report'] as const).map((mode) => (
          <Paper
            variant="outlined"
            key={mode}
            sx={{
              p: { xs: 3, md: 4 },
              borderRadius: 4,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 2,
            }}
          >
            <Box aria-hidden sx={{ fontSize: 34, color: 'primary.main' }}>
              {mode === 'dashboard' ? '▥' : '▤'}
            </Box>
            <Typography variant="h5" fontWeight={700}>
              {mode === 'dashboard' ? copy.dashboardTitle : copy.reportTitle}
            </Typography>
            <Typography
              color="text.secondary"
              sx={{ lineHeight: 1.7, flex: 1 }}
            >
              {mode === 'dashboard' ? copy.dashboardHint : copy.reportHint}
            </Typography>
            <Button
              variant={mode === 'dashboard' ? 'contained' : 'outlined'}
              data-testid={`analytics-mode-${mode}`}
              onClick={() => {
                void navigate(
                  `${base}/assistant-${mode === 'dashboard' ? 'dashboards' : 'reports'}`
                )
              }}
              sx={{ mt: 2 }}
            >
              {mode === 'dashboard' ? copy.dashboardStart : copy.reportStart} →
            </Button>
          </Paper>
        ))}
      </Box>
    </Box>
  )
}
