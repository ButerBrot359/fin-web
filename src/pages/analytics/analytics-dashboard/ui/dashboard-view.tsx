import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import type { AnalyticsSpec } from '@/entities/analytics'
import { DashboardGrid, WidgetGridItem } from '@/features/analytics-widgets'
import {
  AnalyticsParamsPanel,
  expandParams,
  resolveDefaultParams,
} from '@/features/analytics-params'
import type { AnalyticsParamValues } from '@/features/analytics-params'
import { Button } from '@/shared/ui/buttons'

import { areRequiredParamsFilled } from '../lib/utils/params-ready'
import { DashboardWidgetCard } from './dashboard-widget-card'

interface DashboardViewProps {
  spec: AnalyticsSpec
  /** Предпросмотр у ассистента: без кнопки «Обновить», плотнее по вертикали. */
  compact?: boolean
}

/**
 * Тело дашборда: панель параметров + сетка виджетов.
 *
 * Вынесено из страницы отдельно, потому что ровно то же самое показывает
 * предпросмотр ассистента — страница добавляет к этому только шапку вкладки.
 */
export const DashboardView = ({
  spec,
  compact = false,
}: DashboardViewProps) => {
  const { t } = useTranslation()

  const [values, setValues] = useState<AnalyticsParamValues>(() =>
    resolveDefaultParams(spec.parameters)
  )
  const [applied, setApplied] = useState<AnalyticsParamValues>(() =>
    resolveDefaultParams(spec.parameters)
  )
  const [refreshToken, setRefreshToken] = useState(0)

  // Ассистент подменяет спецификацию прямо в предпросмотре — параметры
  // пересобираем под новую спеку, иначе останутся коды от прошлой. Делаем это
  // в рендере по смене пропа, а не в эффекте: иначе первый проход рисует
  // виджеты со старыми параметрами и запросы уходят дважды.
  const [prevSpec, setPrevSpec] = useState(spec)
  if (spec !== prevSpec) {
    setPrevSpec(spec)
    const defaults = resolveDefaultParams(spec.parameters)
    setValues(defaults)
    setApplied(defaults)
  }

  const params = useMemo(
    () => expandParams(spec.parameters, applied),
    [spec.parameters, applied]
  )

  const enabled = areRequiredParamsFilled(spec.parameters, applied)

  const handleApply = () => {
    setApplied(values)
  }

  const handleRefresh = () => {
    setRefreshToken((prev) => prev + 1)
  }

  if (spec.widgets.length === 0) {
    return (
      <Typography variant="body2" className="text-ui-05">
        {t('analytics.dashboard.empty')}
      </Typography>
    )
  }

  return (
    <div className={compact ? 'flex flex-col gap-3' : 'flex flex-col gap-5'}>
      {spec.parameters.length > 0 && (
        <AnalyticsParamsPanel
          parameters={spec.parameters}
          values={values}
          onChange={setValues}
          onApply={handleApply}
        />
      )}

      {!compact && (
        <div className="flex justify-end">
          <Button size="small" variant="secondary" onClick={handleRefresh}>
            {t('analytics.dashboard.refresh')}
          </Button>
        </div>
      )}

      <DashboardGrid layout={spec.layout}>
        {spec.widgets.map((widget) => (
          <WidgetGridItem key={widget.id} position={widget.position}>
            <DashboardWidgetCard
              widget={widget}
              spec={spec}
              params={params}
              enabled={enabled}
              refreshToken={refreshToken}
            />
          </WidgetGridItem>
        ))}
      </DashboardGrid>
    </div>
  )
}
