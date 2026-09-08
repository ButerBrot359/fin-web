import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import type {
  AnalyticsColumn,
  AnalyticsEncoding,
  AnalyticsQueryResult,
} from '@/entities/analytics'

import {
  aggregateNumbers,
  buildSpecMap,
  columnNumbers,
  findColumnIndex,
  resolveFormat,
} from '../../lib/build-chart-data'
import { formatValue, pickLabel } from '../../lib/format-value'
import { cssVar, semantic } from '@/shared/design/tokens'
import { MICRO_LABEL_SX } from '@/shared/ui/micro-label'
import {
  deltaBackground,
  NEGATIVE_COLOR,
  NEUTRAL_COLOR,
  POSITIVE_COLOR,
} from '../../lib/chart-colors'

export interface KpiWidgetProps {
  encoding: AnalyticsEncoding
  result: AnalyticsQueryResult
  specColumns?: AnalyticsColumn[]
  /**
   * Заголовок виджета — запасная подпись. Оболочка не рисует заголовок над
   * KPI, чтобы он не дублировал подпись показателя; но подпись берётся из
   * `encoding.value.label`, а модель заполняет её не всегда. Без запасного
   * варианта плитка остаётся голым числом без объяснения, что это.
   */
  title?: string
}

const deltaColor = (percent: number): string => {
  if (percent > 0) return POSITIVE_COLOR
  if (percent < 0) return NEGATIVE_COLOR
  return NEUTRAL_COLOR
}

/**
 * Крупный показатель: агрегат по колонке `encoding.value` и, если задана
 * колонка `encoding.delta`, процент отклонения от неё.
 *
 * Ноль — валидный ответ, поэтому пустого состояния у KPI нет: при отсутствии
 * строк показываем 0, а не «нет данных».
 */
export const KpiWidget = ({
  encoding,
  result,
  specColumns,
  title,
}: KpiWidgetProps) => {
  const { i18n } = useTranslation()
  const spec = buildSpecMap(specColumns)

  const valueIndex = findColumnIndex(result.columns, encoding.value?.field)
  const current =
    aggregateNumbers(
      columnNumbers(result.rows, valueIndex),
      encoding.value?.aggregate
    ) ?? 0

  const deltaIndex = findColumnIndex(result.columns, encoding.delta?.field)
  const baseline =
    deltaIndex < 0
      ? null
      : aggregateNumbers(
          columnNumbers(result.rows, deltaIndex),
          encoding.delta?.aggregate ?? encoding.value?.aggregate
        )

  const percent =
    baseline != null && baseline !== 0
      ? ((current - baseline) / Math.abs(baseline)) * 100
      : null

  const caption = pickLabel(encoding.value, '', i18n.language) || (title ?? '')
  const format = resolveFormat(encoding.value, spec)

  // Подпись идёт НАД числом: сначала «что», потом «сколько». Число — герой
  // плитки, поэтому крупный кегль, плотный трекинг и табличные цифры (иначе
  // соседние KPI на дашборде не выравниваются по разрядам).
  return (
    <div className="flex h-full min-h-0 flex-col justify-center gap-1.5">
      {caption && (
        <Typography className="truncate" sx={MICRO_LABEL_SX} title={caption}>
          {caption}
        </Typography>
      )}
      <Typography
        className="truncate"
        sx={{
          // Те же грабли каскада, что у микро-лейбла: кегль и вес должны идти
          // через sx, иначе их перебьёт MuiTypography-body1.
          fontSize: 30,
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: '-0.02em',
          color: cssVar(semantic.textPrimary),
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatValue(current, format)}
      </Typography>
      {percent != null && (
        <span
          className="mt-0.5 inline-flex w-fit items-center rounded-sm px-1.5 py-0.5 text-[12px] font-semibold tabular-nums"
          style={{
            color: deltaColor(percent),
            backgroundColor: deltaBackground(percent),
          }}
        >
          {percent > 0 ? '+' : ''}
          {formatValue(percent, 'PERCENT')}
        </span>
      )}
    </div>
  )
}
