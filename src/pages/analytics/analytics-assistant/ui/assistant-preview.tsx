import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import type { AnalyticsSpec } from '@/entities/analytics'
import { MicroLabel } from '@/shared/ui/micro-label'
import { DashboardView } from '@/pages/analytics/analytics-dashboard/ui/dashboard-view'
import { ReportView } from '@/pages/analytics/analytics-report/ui/report-view'

interface AssistantPreviewProps {
  spec: AnalyticsSpec | null
  isPending: boolean
}

/**
 * Живой предпросмотр построенной спецификации — ровно те же компоненты, что и
 * на сохранённых страницах: дашборд рисуется сеткой виджетов, отчёт — таблицей.
 *
 * Пока представления нет, холст не мигает скелетоном: ход генерации показан
 * этапами в ленте диалога, здесь достаточно одной честной строки.
 */
export const AssistantPreview = ({
  spec,
  isPending,
}: AssistantPreviewProps) => {
  const { t } = useTranslation()

  if (!spec) {
    return (
      <div className="flex h-full min-h-40 items-center justify-center rounded-lg bg-ui-01 p-6">
        <Typography variant="body2" className="max-w-80 text-center text-ui-05">
          {isPending
            ? t('analytics.assistant.previewPending')
            : t('analytics.assistant.emptyHint')}
        </Typography>
      </div>
    )
  }

  const title = spec.title ?? ''
  const kindLabel =
    spec.kind === 'REPORT'
      ? t('analytics.assistant.kindReport')
      : t('analytics.assistant.kindDashboard')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <MicroLabel>{kindLabel}</MicroLabel>
        {title && (
          <Typography
            component="h2"
            className="text-[20px] leading-7 font-bold tracking-[-0.01em] text-ui-06"
          >
            {title}
          </Typography>
        )}
      </div>

      {spec.kind === 'DASHBOARD' ? (
        <DashboardView spec={spec} compact />
      ) : (
        <ReportView spec={spec} title={title} autoBuild />
      )}
    </div>
  )
}
