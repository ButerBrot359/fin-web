import { useTranslation } from 'react-i18next'
import { Button, Typography } from '@mui/material'

import type { AnalyticsParameter } from '@/entities/analytics'

import type { AnalyticsParamValues } from '../types/params'
import { ParamField } from './param-field'

export interface AnalyticsParamsPanelProps {
  parameters: AnalyticsParameter[]
  values: AnalyticsParamValues
  onChange: (values: AnalyticsParamValues) => void
  onApply: () => void
  isLoading?: boolean
}

/** Ширина ячейки под контрол: период занимает две даты, флажок — по содержимому. */
const fieldWidth = (type: AnalyticsParameter['type']): string => {
  if (type === 'DATE_RANGE') return 'w-[28rem]'
  if (type === 'BOOLEAN') return 'w-auto'
  return 'w-56'
}

const isMissing = (parameter: AnalyticsParameter, value: unknown): boolean => {
  if (!parameter.required) return false
  if (parameter.type === 'BOOLEAN') return false
  if (parameter.type === 'DATE_RANGE') {
    const range = value as { from?: unknown; to?: unknown } | null
    return !range?.from || !range.to
  }
  return value == null || value === ''
}

/**
 * Панель параметров над отчётом или дашбордом — одна строка контролов, а не
 * карточка: это управление содержимым, а не отдельный объект. Отбита от
 * содержимого волосяной линией снизу.
 *
 * Пока не заполнены обязательные параметры, запускать запрос нельзя — иначе
 * бэкенд ответит ошибкой подстановки. Поэтому рядом с кнопкой стоит подсказка,
 * что именно мешает: заблокированная кнопка без объяснения выглядит поломкой.
 */
export const AnalyticsParamsPanel = ({
  parameters,
  values,
  onChange,
  onApply,
  isLoading,
}: AnalyticsParamsPanelProps) => {
  const { t } = useTranslation()

  if (parameters.length === 0) return null

  const missing = parameters.some((parameter) =>
    isMissing(parameter, values[parameter.code])
  )

  return (
    <div className="flex flex-wrap items-end gap-x-3 gap-y-2 border-b border-ui-03 pb-3">
      {/*
        Ширину задаёт контейнер, а не поле: тема проекта форсирует
        `fullWidth: true` у MuiTextField, и класс ширины на самом поле она
        перебивает — поля разъезжались на всю строку.
      */}
      {parameters.map((parameter) => (
        <div key={parameter.code} className={fieldWidth(parameter.type)}>
          <ParamField
            parameter={parameter}
            value={values[parameter.code]}
            disabled={isLoading}
            onChange={(next) => {
              onChange({ ...values, [parameter.code]: next })
            }}
          />
        </div>
      ))}

      {/* mb-1 компенсирует marginBottom: 4 у MuiFormControl из темы — иначе
          кнопка стоит на четыре пикселя ниже нижнего края полей. */}
      <div className="ml-auto mb-1 flex items-center gap-3">
        {missing && (
          <Typography variant="caption" className="text-ui-05">
            {t('analytics.params.required')}
          </Typography>
        )}
        <Button
          size="small"
          variant="outlined"
          onClick={onApply}
          disabled={Boolean(isLoading) || missing}
        >
          {t('analytics.params.apply')}
        </Button>
      </div>
    </div>
  )
}
