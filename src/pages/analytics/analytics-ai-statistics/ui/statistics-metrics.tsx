import { Box, Paper, Skeleton, Tooltip, Typography } from '@mui/material'
import type { AiStatistics } from '@/entities/analytics'
import type { StatisticsCopy } from '../lib/statistics-copy'
import { formatStatistic, STATISTICS_METRICS } from '../lib/statistics-format'

export function StatisticsMetrics({
  data,
  copy,
  locale,
  loading,
  section,
}: {
  data: AiStatistics | null
  copy: StatisticsCopy
  locale: string
  loading: boolean
  section: 'hero' | 'details'
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(2, minmax(0, 1fr))',
          md: 'repeat(4, minmax(0, 1fr))',
        },
        gap: 1.5,
      }}
    >
      {STATISTICS_METRICS.slice(
        section === 'hero' ? 0 : 4,
        section === 'hero' ? 4 : undefined
      ).map(({ key, unit }) => (
        <Tooltip key={key} title={copy.metrics[key][1]} arrow>
          <Paper
            data-testid={`ai-statistic-${key}`}
            variant="outlined"
            sx={{
              p: { xs: 1.5, sm: 2 },
              borderRadius: 3,
              minWidth: 0,
              ...(section === 'hero'
                ? {
                    bgcolor: 'action.hover',
                    borderTop: '3px solid',
                    borderTopColor: 'primary.main',
                  }
                : {}),
            }}
          >
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ minHeight: 40 }}
            >
              {copy.metrics[key][0]}
            </Typography>
            {loading ? (
              <Skeleton width="65%" height={36} />
            ) : (
              <Typography
                sx={{
                  fontSize: { xs: 22, sm: 27 },
                  fontWeight: 650,
                  letterSpacing: '-0.04em',
                  overflowWrap: 'anywhere',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatStatistic(data?.metrics[key] ?? null, unit, locale)}
                {data?.metrics[key] != null &&
                  unit !== 'count' &&
                  unit !== 'average' && (
                    <Box
                      component="span"
                      sx={{
                        fontSize: 12,
                        ml: 0.75,
                        color: 'text.secondary',
                        letterSpacing: 0,
                      }}
                    >
                      {unit === 'cost'
                        ? data.currency
                        : unit === 'latency'
                          ? copy.seconds
                          : '%'}
                    </Box>
                  )}
              </Typography>
            )}
          </Paper>
        </Tooltip>
      ))}
    </Box>
  )
}
