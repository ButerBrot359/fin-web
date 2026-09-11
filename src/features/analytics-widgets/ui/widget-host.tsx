import type { ReactNode } from 'react'
import { extractErrorText } from '@/features/analytics-assistant/lib/utils/assistant-error'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import type {
  AnalyticsColumn,
  AnalyticsQueryResult,
  AnalyticsWidget,
} from '@/entities/analytics'

import { pickTitle } from '../lib/format-value'
import { AnalyticsTable } from './analytics-table'
import { WidgetCard } from './widget-card'
import { BarWidget } from './charts/bar-widget'
import { KpiWidget } from './charts/kpi-widget'
import { LineWidget } from './charts/line-widget'
import { PieWidget } from './charts/pie-widget'
import { TextWidget } from './charts/text-widget'

export interface WidgetHostProps {
  widget: AnalyticsWidget
  specColumns: AnalyticsColumn[]
  result: AnalyticsQueryResult | null
  isLoading: boolean
  error?: unknown
  onRefresh?: () => void
}

/**
 * Диспетчер виджетов. Рисуем `effectiveType ?? type`: бэкенд подменяет вид,
 * когда исходный не подходит данным (PIE со знаковой мерой — как BAR, иначе
 * круговая диаграмма выходит пустой без единой ошибки).
 */
export const WidgetHost = ({
  widget,
  specColumns,
  result,
  isLoading,
  error,
  onRefresh,
}: WidgetHostProps) => {
  const { i18n } = useTranslation()
  const type = widget.effectiveType ?? widget.type
  const encoding = widget.encoding

  const hasRows = (result?.rows.length ?? 0) > 0
  // TEXT рисуется без датасета, KPI считает ноль валидным ответом.
  const isEmpty = type !== 'TEXT' && type !== 'KPI' && !hasRows

  const renderContent = (): ReactNode => {
    if (type === 'TEXT') return <TextWidget markdown={encoding.markdown} />
    if (!result) return null

    const common = { encoding, result, specColumns }
    switch (type) {
      case 'KPI':
        return (
          <KpiWidget {...common} title={pickTitle(widget, i18n.language)} />
        )
      case 'LINE':
      case 'AREA':
        return <LineWidget type={type} {...common} />
      case 'BAR':
      case 'BAR_HORIZONTAL':
        return <BarWidget type={type} {...common} />
      case 'PIE':
      case 'DONUT':
        return <PieWidget type={type} {...common} />
      case 'TABLE':
      case 'PIVOT':
        return (
          <AnalyticsTable
            columns={result.columns}
            rows={result.rows}
            specColumns={specColumns}
            encoding={encoding}
          />
        )
      default:
        // Неизвестный вид не должен ронять страницу: аккуратная заглушка.
        return (
          <div className="flex h-full min-h-24 items-center justify-center">
            <Typography className="text-body2 text-ui-05">{type}</Typography>
          </div>
        )
    }
  }

  return (
    <WidgetCard
      title={pickTitle(widget, i18n.language)}
      isDegraded={widget.effectiveType != null}
      degradedReason={widget.effectiveTypeReason}
      isLoading={isLoading}
      hasError={error != null}
      errorText={extractErrorText(error)}
      isEmpty={isEmpty}
      zeroIsValid={type === 'KPI'}
      // У KPI подпись показателя стоит над числом внутри самой плитки —
      // заголовок сверху дублировал бы её слово в слово.
      hideTitle={type === 'KPI'}
      onRefresh={onRefresh}
    >
      {renderContent()}
    </WidgetCard>
  )
}
