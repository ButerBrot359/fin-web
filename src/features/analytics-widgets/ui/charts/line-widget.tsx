import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { LineChart } from '@mui/x-charts/LineChart'

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

export interface LineWidgetProps {
  type: 'LINE' | 'AREA'
  encoding: AnalyticsEncoding
  result: AnalyticsQueryResult
  specColumns?: AnalyticsColumn[]
}

/** Отметки на точках мешают при плотном ряде — включаем только на коротких. */
const MARK_LIMIT = 40

/** Линейный и площадной графики: ось X — `encoding.x`, серии — `encoding.y`. */
export const LineWidget = ({
  type,
  encoding,
  result,
  specColumns,
}: LineWidgetProps) => {
  const { i18n } = useTranslation()
  const lang = i18n.language

  const data = useMemo(
    () => buildCartesianData({ result, encoding, specColumns, lang }),
    [result, encoding, specColumns, lang]
  )

  const series = data.series.map((item) => ({
    dataKey: item.dataKey,
    label: item.label,
    color: item.color,
    stack: item.stack,
    area: type === 'AREA',
    // null — разрыв линии, а не ноль: соединять такие точки нельзя.
    connectNulls: false,
    showMark: data.dataset.length <= MARK_LIMIT,
    valueFormatter: (value: number | null) => formatValue(value, item.format),
  }))

  return (
    <div className="h-full min-h-44 w-full">
      <LineChart
        dataset={data.dataset}
        xAxis={[
          {
            dataKey: X_KEY,
            scaleType: 'point',
            tickLabelStyle: TICK_LABEL_STYLE,
          },
        ]}
        yAxis={VALUE_AXIS}
        series={series}
        colors={CHART_COLORS}
        grid={{ horizontal: true }}
        hideLegend={series.length < 2}
        sx={CHART_SX}
        margin={CHART_MARGIN}
      />
    </div>
  )
}
