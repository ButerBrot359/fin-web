import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import { useAnalyticsDataset } from '@/entities/analytics'
import type { AnalyticsSpec } from '@/entities/analytics'
import { AnalyticsTable } from '@/features/analytics-widgets'
import {
  AnalyticsOrganizationSelect,
  useSelectedOrganizationName,
} from '@/features/analytics-organization'
import { AnalyticsParamsPanel, expandParams } from '@/features/analytics-params'
import { Button } from '@/shared/ui/buttons'
import { ShimmerBlock } from '@/shared/ui/shimmer-block'
import { areRequiredParamsFilled } from '@/pages/analytics/analytics-dashboard/lib/utils/params-ready'

import { useReportParamsUrl } from '../lib/hooks/use-report-params-url'
import {
  exportReportToCsv,
  exportReportToXlsx,
} from '../lib/utils/report-export'
import { ReportSummary } from './report-summary'
import { ReportToolbar } from './report-toolbar'

interface ReportViewProps {
  spec: AnalyticsSpec
  title: string
}

/**
 * Тело отчёта: параметры, кнопка «Сформировать» и таблица результата.
 *
 * Запрос идёт только по «Сформировать» — отчёты бывают тяжёлыми, дёргать их на
 * каждое нажатие в поле нельзя. То же тело переиспользует предпросмотр
 * ассистента.
 */
export const ReportView = ({ spec, title }: ReportViewProps) => {
  const { t, i18n } = useTranslation()
  const isKz = i18n.language === 'kz'

  const dataset = useMemo(() => {
    const widgetDatasetId = spec.widgets.find((w) => w.datasetId)?.datasetId
    return (
      spec.datasets.find((item) => item.id === widgetDatasetId) ??
      // .at(0), а не [0]: без noUncheckedIndexedAccess индексный доступ
      // типизируется как непустой, и защита от пустого списка «схлопывается».
      spec.datasets.at(0) ??
      null
    )
  }, [spec])

  const widget = spec.widgets.find((w) => w.datasetId === dataset?.id)

  const { values, setValues, applied, apply } = useReportParamsUrl(
    spec.parameters
  )

  const params = useMemo(
    () => (applied ? expandParams(spec.parameters, applied) : {}),
    [spec.parameters, applied]
  )

  const canBuild = areRequiredParamsFilled(spec.parameters, values)
  const enabled =
    applied != null &&
    dataset != null &&
    areRequiredParamsFilled(spec.parameters, applied)

  const { result, isLoading, isError, refetch } = useAnalyticsDataset(
    dataset,
    params,
    enabled
  )

  const handleBuild = () => {
    if (!canBuild) return
    // Те же параметры, что уже в URL → кэш вернётся без запроса, форсим refetch.
    if (apply() && enabled) void refetch()
  }

  const organizationName = useSelectedOrganizationName()
  const columns = dataset?.columns ?? []
  const hasRows = result != null && result.rows.length > 0

  return (
    <div className="flex flex-col gap-4">
      {spec.parameters.length > 0 && (
        <AnalyticsParamsPanel
          parameters={spec.parameters}
          values={values}
          onChange={setValues}
          onApply={handleBuild}
          isLoading={isLoading}
        />
      )}

      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-wrap items-end gap-3">
          <AnalyticsOrganizationSelect />
          <Button
            variant="primary"
            disabled={!canBuild || isLoading}
            onClick={handleBuild}
          >
            {t('analytics.report.build')}
          </Button>
        </div>

        <ReportToolbar
          disabled={!hasRows}
          onExportXlsx={() => {
            if (result) {
              exportReportToXlsx(title, columns, result, i18n.language)
            }
          }}
          onExportCsv={() => {
            if (result) exportReportToCsv(title, columns, result, isKz)
          }}
          onPrint={() => {
            window.print()
          }}
        />
      </div>

      {isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <ShimmerBlock key={index} className="h-8 w-full" />
          ))}
        </div>
      )}

      {!isLoading && isError && (
        <Typography variant="body2" className="text-support-01">
          {t('analytics.errors.executeFailed')}
        </Typography>
      )}

      {!isLoading && !isError && result && !hasRows && (
        <Typography variant="body2" className="text-ui-05">
          {t('analytics.report.noData')}
        </Typography>
      )}

      {!isLoading && !isError && result && hasRows && (
        <>
          {/* Таблица — белая панель на тонированной подложке страницы. */}
          <div className="report-print-area rounded-lg bg-ui-01 p-4">
            <AnalyticsTable
              columns={result.columns}
              rows={result.rows}
              specColumns={columns}
              encoding={widget?.encoding}
              // Организация — в заголовке таблицы: на печати отчёт без неё
              // неоднозначен, а «все организации» отдельно не подписываем.
              title={
                organizationName ? `${title} · ${organizationName}` : title
              }
              showTotals
            />
          </div>
          <ReportSummary result={result} />
        </>
      )}
    </div>
  )
}
