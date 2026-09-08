import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { PieChart } from '@mui/x-charts/PieChart'

import type {
  AnalyticsColumn,
  AnalyticsEncoding,
  AnalyticsQueryResult,
} from '@/entities/analytics'

import {
  buildPieData,
  buildSpecMap,
  resolveFormat,
} from '../../lib/build-chart-data'
import { CHART_COLORS } from '../../lib/chart-colors'
import { formatValue } from '../../lib/format-value'
import { CHART_SX, CHART_MARGIN } from '../../lib/chart-theme'

export interface PieWidgetProps {
  type: 'PIE' | 'DONUT'
  encoding: AnalyticsEncoding
  result: AnalyticsQueryResult
  specColumns?: AnalyticsColumn[]
}

/** Больше секторов не читается — хвост сворачивается в один. */
const MAX_SLICES = 15
/** Легенда длиннее этого списка съедает всю площадь виджета. */
const LEGEND_LIMIT = 10

export const PieWidget = ({
  type,
  encoding,
  result,
  specColumns,
}: PieWidgetProps) => {
  const { i18n } = useTranslation()
  const lang = i18n.language

  const slices = useMemo(
    () => buildPieData({ result, encoding, specColumns, lang }, MAX_SLICES),
    [result, encoding, specColumns, lang]
  )

  const format = resolveFormat(encoding.value, buildSpecMap(specColumns))

  return (
    <div className="h-full min-h-44 w-full">
      <PieChart
        colors={CHART_COLORS}
        hideLegend={slices.length > LEGEND_LIMIT}
        series={[
          {
            data: slices,
            innerRadius: type === 'DONUT' ? '55%' : 0,
            outerRadius: '95%',
            paddingAngle: slices.length > 1 ? 1 : 0,
            cornerRadius: 2,
            valueFormatter: (item: { value: number }) =>
              formatValue(item.value, format),
          },
        ]}
        sx={CHART_SX}
        margin={CHART_MARGIN}
      />
    </div>
  )
}
