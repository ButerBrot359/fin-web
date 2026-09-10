import { Box, Paper, Typography } from '@mui/material'
import { LineChart } from '@mui/x-charts/LineChart'
import { BarChart } from '@mui/x-charts/BarChart'
import type { AiStatistics } from '@/entities/analytics'
import type { StatisticsCopy } from '../lib/statistics-copy'
import { formatBucket, formatStatistic } from '../lib/statistics-format'

export function StatisticsCharts({
  data,
  copy,
  locale,
}: {
  data: AiStatistics
  copy: StatisticsCopy
  locale: string
}) {
  const labels = data.series.map((row) =>
    formatBucket(row.bucket, locale, data.groupBy === 'MONTH')
  )
  const frame = {
    height: 260,
    skipAnimation: true,
    yAxis: [
      {
        width: 60,
        valueFormatter: (value: number) =>
          new Intl.NumberFormat(locale, {
            notation: 'compact',
            maximumFractionDigits: 1,
          }).format(value),
      },
    ],
    grid: { horizontal: true },
    margin: { top: 20, right: 16, left: 8 },
  }
  const charts = [
    {
      title: copy.requestsChart,
      subtitle: copy.requestsChartSubtitle,
      content: (
        <LineChart
          {...frame}
          xAxis={[{ data: labels, scaleType: 'point' }]}
          series={[
            {
              data: data.series.map((r) => r.requests),
              label: copy.requests,
              color: '#635bff',
              showMark: false,
            },
            {
              data: data.series.map((r) => r.errorCount),
              label: copy.errors,
              color: '#e66b65',
              showMark: false,
            },
          ]}
        />
      ),
    },
    {
      title: copy.tokensChart,
      subtitle: copy.tokensChartSubtitle,
      content: (
        <BarChart
          {...frame}
          xAxis={[{ data: labels, scaleType: 'band' }]}
          series={[
            {
              data: data.series.map((r) => r.inputTokens),
              label: copy.input,
              stack: 'tokens',
              color: '#635bff',
            },
            {
              data: data.series.map((r) => r.outputTokens),
              label: copy.output,
              stack: 'tokens',
              color: '#39b8ab',
            },
          ]}
        />
      ),
    },
    {
      title: copy.latencyChart,
      subtitle: `${copy.latencyChartSubtitle} (${copy.seconds})`,
      content: (
        <LineChart
          {...frame}
          xAxis={[{ data: labels, scaleType: 'point' }]}
          series={[
            {
              data: data.series.map((r) =>
                r.avgLatencyMs == null ? null : r.avgLatencyMs / 1000
              ),
              label: copy.modelLatency,
              color: '#39b8ab',
              showMark: false,
              valueFormatter: (v) =>
                `${formatStatistic(v, 'average', locale)} ${copy.seconds}`,
            },
          ]}
        />
      ),
    },
    {
      title: copy.costChart,
      subtitle: `${copy.costChartSubtitle} (${data.currency})`,
      content: data.series.some((r) => r.estimatedCost != null) ? (
        <BarChart
          {...frame}
          xAxis={[{ data: labels, scaleType: 'band' }]}
          series={[
            {
              data: data.series.map((r) => r.estimatedCost),
              label: copy.costChart,
              color: '#d39c3f',
              valueFormatter: (v) =>
                `${formatStatistic(v, 'cost', locale)} ${data.currency}`,
            },
          ]}
        />
      ) : (
        <Box
          sx={{
            height: 260,
            display: 'grid',
            placeContent: 'center',
            textAlign: 'center',
            px: 3,
          }}
        >
          <Typography fontWeight={600}>{copy.costUnavailable}</Typography>
          <Typography variant="body2" color="text.secondary" mt={1}>
            {copy.costExplanation}
          </Typography>
        </Box>
      ),
    },
  ]
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
        gap: 2,
      }}
    >
      {charts.map((chart) => (
        <Paper
          key={chart.title}
          variant="outlined"
          sx={{ p: { xs: 1.5, sm: 2.5 }, borderRadius: 3, minWidth: 0 }}
        >
          <Typography fontWeight={600}>{chart.title}</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            {chart.subtitle}
          </Typography>
          {data.series.length ? (
            chart.content
          ) : (
            <Box
              sx={{
                height: 260,
                display: 'grid',
                placeItems: 'center',
                color: 'text.secondary',
              }}
            >
              {copy.noSeries}
            </Box>
          )}
        </Paper>
      ))}
    </Box>
  )
}
