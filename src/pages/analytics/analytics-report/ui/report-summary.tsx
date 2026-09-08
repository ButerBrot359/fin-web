import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import type { AnalyticsQueryResult } from '@/entities/analytics'

interface ReportSummaryProps {
  result: AnalyticsQueryResult
}

/** Подвал отчёта: сколько строк, сколько выполнялся, не обрезан ли результат. */
export const ReportSummary = ({ result }: ReportSummaryProps) => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-4">
        <Typography variant="caption" className="text-ui-05">
          {`${t('analytics.report.rows')}: ${String(result.rowCount)}`}
        </Typography>
        <Typography variant="caption" className="text-ui-05">
          {`${t('analytics.report.executionTime')}: ${String(result.executionMs)} ms`}
        </Typography>
      </div>

      {result.truncated && (
        <Typography variant="caption" className="text-support-01">
          {t('analytics.report.truncated')}
        </Typography>
      )}
    </div>
  )
}
