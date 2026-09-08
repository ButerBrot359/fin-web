import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart } from '@mui/x-charts/BarChart'

import type {
  AnalyticsColumn,
  AnalyticsEncoding,
  AnalyticsQueryResult,
} from '@/entities/analytics'

import { buildCartesianData, X_KEY } from '../../lib/build-chart-data'
import { CHART_COLORS } from '../../lib/chart-colors'
import { formatValue } from '../../lib/format-value'
import {
  CHART_MARGIN,
  CHART_SX,
  TICK_LABEL_STYLE,
  VALUE_AXIS,
} from '../../lib/chart-theme'

export interface BarWidgetProps {
  type: 'BAR' | 'BAR_HORIZONTAL'
  encoding: AnalyticsEncoding
  result: AnalyticsQueryResult
  specColumns?: AnalyticsColumn[]
}

/**
 * Столбчатая диаграмма. В горизонтальном варианте категориальная ось —
 * это Y, поэтому оси меняются местами; `stacked` из спецификации даёт общий
 * `stack` всем сериям.
 */
export const BarWidget = ({
  type,
  encoding,
  result,
  specColumns,
}: BarWidgetProps) => {
  const { i18n } = useTranslation()
  const lang = i18n.language
  const horizontal = type === 'BAR_HORIZONTAL'

  const data = useMemo(
    () => buildCartesianData({ result, encoding, specColumns, lang }),
    [result, encoding, specColumns, lang]
  )

  const series = data.series.map((item) => ({
    dataKey: item.dataKey,
    label: item.label,
    color: item.color,
    stack: item.stack,
    valueFormatter: (value: number | null) => formatValue(value, item.format),
  }))

  const categoryAxis = [
    {
      dataKey: X_KEY,
      scaleType: 'band' as const,
      tickLabelStyle: TICK_LABEL_STYLE,
    },
  ]

  return (
    <div className="h-full min-h-44 w-full">
      <BarChart
        dataset={data.dataset}
        layout={horizontal ? 'horizontal' : 'vertical'}
        xAxis={horizontal ? VALUE_AXIS : categoryAxis}
        yAxis={horizontal ? categoryAxis : VALUE_AXIS}
        series={series}
        colors={CHART_COLORS}
        grid={horizontal ? { vertical: true } : { horizontal: true }}
        hideLegend={series.length < 2}
        sx={CHART_SX}
        margin={CHART_MARGIN}
      />
    </div>
  )
}
