import {
  Alert,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import type { AiStatistics } from '@/entities/analytics'
import type { StatisticsCopy } from '../lib/statistics-copy'
import { formatStatistic } from '../lib/statistics-format'

export function StatisticsModels({
  data,
  copy,
  locale,
}: {
  data: AiStatistics
  copy: StatisticsCopy
  locale: string
}) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
      <Box p={2.5}>
        <Typography fontWeight={600}>{copy.modelsTitle}</Typography>
        <Typography variant="body2" color="text.secondary">
          {copy.modelsSubtitle}
        </Typography>
      </Box>
      {data.modelsTruncated && (
        <Alert severity="info" sx={{ mx: 2 }}>
          {copy.modelsTruncated}
        </Alert>
      )}
      <TableContainer>
        <Table size="small" sx={{ minWidth: 650 }}>
          <TableHead>
            <TableRow>
              {[
                copy.model,
                copy.modelRequests,
                copy.modelErrors,
                copy.modelTokens,
                `${copy.modelLatency}, ${copy.seconds}`,
                `${copy.modelCost}, ${data.currency}`,
              ].map((label, i) => (
                <TableCell
                  key={label}
                  align={i ? 'right' : 'left'}
                  sx={{
                    color: 'text.secondary',
                    bgcolor: 'action.hover',
                    py: 1.5,
                  }}
                >
                  {label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.byModel.map((model, index) => (
              <TableRow
                key={`${model.provider}/${model.model}/${String(index)}`}
                hover
              >
                <TableCell sx={{ py: 1.5 }}>
                  <Typography variant="body2" fontWeight={600}>
                    {model.model || copy.unknownModel}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {model.provider || copy.unknownProvider}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  {formatStatistic(model.requests, 'count', locale)}
                </TableCell>
                <TableCell align="right">
                  {formatStatistic(model.errorCount, 'count', locale)}
                </TableCell>
                <TableCell align="right">
                  {formatStatistic(model.totalTokens, 'count', locale)}
                </TableCell>
                <TableCell align="right">
                  {formatStatistic(model.avgLatencyMs, 'latency', locale)}
                </TableCell>
                <TableCell align="right">
                  {formatStatistic(model.estimatedCost, 'cost', locale)}
                </TableCell>
              </TableRow>
            ))}
            {!data.byModel.length && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  {copy.noSeries}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  )
}
