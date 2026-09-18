import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import RefreshRounded from '@mui/icons-material/RefreshRounded'
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded'
import { useAiStatistics, type AiStatisticsFilters } from '@/entities/analytics'
import { useTabMeta, useWorkspaceTabsStore } from '@/features/workspace-tabs'
import { PageHeader } from '@/widgets/page-header'
import { getStatisticsCopy, statisticsLocale } from '../lib/statistics-copy'
import {
  formatStatistic,
  isValidStatisticsPeriod,
  recentPeriod,
} from '../lib/statistics-format'
import { formatStatisticsNote } from '../lib/statistics-notes'
import { StatisticsMetrics } from './statistics-metrics'
import { StatisticsCharts } from './statistics-charts'
import { StatisticsModels } from './statistics-models'

export function AnalyticsAiStatisticsPage() {
  const { i18n } = useTranslation()
  const copy = getStatisticsCopy(i18n.language)
  const locale = statisticsLocale(i18n.language)
  const location = useLocation()
  const navigate = useNavigate()
  useTabMeta(copy.title)
  const [filters, setFilters] = useState<AiStatisticsFilters>(() => ({
    ...recentPeriod(30),
    groupBy: 'DAY',
    surface: 'ALL',
  }))
  const [draft, setDraft] = useState(() => ({
    from: filters.from,
    to: filters.to,
  }))
  const validPeriod = isValidStatisticsPeriod(draft.from, draft.to)
  const { data, isLoading, isFetching, isError, refetch } =
    useAiStatistics(filters)
  const scope =
    filters.surface === 'ALL'
      ? copy.allScope
      : filters.surface === 'ASSISTANT'
        ? copy.assistantScope
        : copy.analyticsScope
  const quickPeriod = (days: number) => {
    const dates = recentPeriod(days)
    setDraft(dates)
    setFilters((before) => ({ ...before, ...dates }))
  }
  return (
    <Box
      data-testid="ai-statistics-page"
      sx={{ height: '100%', overflow: 'auto', pt: 2.5, pb: 4 }}
    >
      <PageHeader
        title={copy.title}
        onClose={() => {
          useWorkspaceTabsStore.getState().closeTab(location.pathname)
          void navigate('/')
        }}
      />
      <Stack
        spacing={2.5}
        sx={{ mt: 2.5, maxWidth: 1600, mx: 'auto', px: { xs: 0.5, sm: 1 } }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 3,
              bgcolor: 'action.hover',
              color: 'primary.main',
              display: { xs: 'none', sm: 'flex' },
            }}
          >
            <AutoAwesomeRounded />
          </Box>
          <Box flex={1}>
            <Typography variant="h6" fontWeight={650}>
              {copy.overview}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {copy.subtitle}
            </Typography>
          </Box>
          <Chip size="small" label={copy.twentyMetrics} variant="outlined" />
        </Stack>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
          <Box
            sx={{
              display: 'grid',
              gap: 1.5,
              alignItems: 'end',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                sm: 'repeat(2, minmax(0, 1fr))',
                lg: 'minmax(180px, 1.2fr) repeat(2, minmax(145px, 1fr)) auto auto',
              },
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography
                id="ai-statistics-surface-label"
                variant="caption"
                display="block"
                mb={0.75}
              >
                {copy.surface}
              </Typography>
              <TextField
                select
                fullWidth
                size="small"
                value={filters.surface}
                slotProps={{
                  select: { labelId: 'ai-statistics-surface-label' },
                }}
                onChange={(event) => {
                  setFilters((before) => ({
                    ...before,
                    surface: event.target
                      .value as AiStatisticsFilters['surface'],
                  }))
                }}
              >
                <MenuItem value="ALL">{copy.all}</MenuItem>
                <MenuItem value="ASSISTANT">{copy.assistant}</MenuItem>
                <MenuItem value="ANALYTICS">{copy.analytics}</MenuItem>
              </TextField>
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                component="label"
                htmlFor="ai-statistics-from"
                variant="caption"
                display="block"
                mb={0.75}
              >
                {copy.from}
              </Typography>
              <TextField
                id="ai-statistics-from"
                fullWidth
                type="date"
                size="small"
                value={draft.from}
                onChange={(e) => {
                  setDraft((before) => ({ ...before, from: e.target.value }))
                }}
              />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                component="label"
                htmlFor="ai-statistics-to"
                variant="caption"
                display="block"
                mb={0.75}
              >
                {copy.to}
              </Typography>
              <TextField
                id="ai-statistics-to"
                fullWidth
                type="date"
                size="small"
                value={draft.to}
                onChange={(e) => {
                  setDraft((before) => ({ ...before, to: e.target.value }))
                }}
              />
            </Box>
            <Button
              variant="contained"
              disabled={!validPeriod}
              onClick={() => {
                setFilters((before) => ({ ...before, ...draft }))
              }}
            >
              {copy.apply}
            </Button>
            <Button
              startIcon={<RefreshRounded />}
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              {copy.refresh}
            </Button>
          </Box>
          {!validPeriod && (
            <Typography color="error" variant="caption">
              {copy.invalidPeriod}
            </Typography>
          )}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            gap={1.5}
            mt={2}
          >
            <Stack direction="row" gap={0.5}>
              {([7, 30, 90] as const).map((days) => (
                <Button
                  size="small"
                  key={days}
                  onClick={() => {
                    quickPeriod(days)
                  }}
                >
                  {
                    copy[
                      days === 7 ? 'days7' : days === 30 ? 'days30' : 'days90'
                    ]
                  }
                </Button>
              ))}
            </Stack>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={filters.groupBy}
              aria-label={copy.groupBy}
              onChange={(_, value: AiStatisticsFilters['groupBy'] | null) => {
                if (value)
                  setFilters((before) => ({ ...before, groupBy: value }))
              }}
            >
              <ToggleButton value="DAY">{copy.day}</ToggleButton>
              <ToggleButton value="WEEK">{copy.week}</ToggleButton>
              <ToggleButton value="MONTH">{copy.month}</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </Paper>
        <Box>
          <Typography variant="body2" fontWeight={600} mb={0.75}>
            {copy.period}: {filters.from} — {filters.to}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {scope}
          </Typography>
        </Box>
        {isFetching && <LinearProgress aria-label={copy.loading} />}
        {isError && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" onClick={() => void refetch()}>
                {copy.retry}
              </Button>
            }
          >
            {copy.loadFailed}
          </Alert>
        )}
        {!isLoading && data?.metrics.requests === 0 && (
          <Alert severity="info">
            <Typography fontWeight={600}>{copy.emptyTitle}</Typography>
            {copy.emptyDescription}
          </Alert>
        )}
        <StatisticsMetrics
          data={data}
          copy={copy}
          locale={locale}
          loading={isLoading}
          section="hero"
        />
        {data && (
          <>
            <Typography variant="h6" fontWeight={600}>
              {copy.dynamics}
            </Typography>
            <StatisticsCharts data={data} copy={copy} locale={locale} />
          </>
        )}
        <Typography variant="h6" fontWeight={600}>
          {copy.details}
        </Typography>
        <StatisticsMetrics
          data={data}
          copy={copy}
          locale={locale}
          loading={isLoading}
          section="details"
        />
        {data && (
          <>
            <StatisticsModels data={data} copy={copy} locale={locale} />
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
              <Typography fontWeight={600} mb={1}>
                {copy.calculations}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {copy.estimatedOnly}
              </Typography>
              <Stack direction="row" gap={1} flexWrap="wrap" my={1.5}>
                <Chip
                  size="small"
                  variant="outlined"
                  label={`${copy.timezone}: ${data.timezone}`}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={`${copy.pricingCoverage}: ${formatStatistic(data.pricingCoveragePercent, 'percent', locale)}${data.pricingCoveragePercent == null ? '' : '%'}`}
                />
                <Chip size="small" variant="outlined" label={data.currency} />
              </Stack>
              {data.notes.map((note) => {
                const text = formatStatisticsNote(note, i18n.language)
                return text ? (
                  <Typography
                    key={note}
                    variant="body2"
                    color="text.secondary"
                    mt={0.75}
                  >
                    {text}
                  </Typography>
                ) : null
              })}
            </Paper>
          </>
        )}
      </Stack>
    </Box>
  )
}
