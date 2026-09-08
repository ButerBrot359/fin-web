import { useTranslation } from 'react-i18next'

import { DateTimeInput } from '@/shared/ui/inputs'
import { MicroLabel } from '@/shared/ui/micro-label'

import { toIsoDate } from '../lib/resolve-default-params'
import type { AnalyticsDateRangeValue } from '../types/params'

interface ParamDateRangeFieldProps {
  label: string
  value: AnalyticsDateRangeValue
  onChange: (value: AnalyticsDateRangeValue) => void
  disabled?: boolean
}

/**
 * Период: две даты под общим микро-лейблом. Общая подпись набрана мелко и
 * заглавными, чтобы пара пикеров не вырастала над соседними полями.
 *
 * Поля — `DateTimeInput` проекта: тема рассчитана на filled-вариант во всю
 * ширину контейнера, и попытка задать ширину самому полю ломает посадку
 * плавающей подписи (она наезжает на значение).
 */
export const ParamDateRangeField = ({
  label,
  value,
  onChange,
  disabled,
}: ParamDateRangeFieldProps) => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-1">
      <MicroLabel>{label}</MicroLabel>
      <div className="flex items-start gap-2">
        <DateTimeInput
          dateOnly
          fullWidth
          disabled={disabled}
          label={t('analytics.params.from')}
          value={value.from ?? ''}
          onChange={(next) => {
            onChange({ ...value, from: toIsoDate(next) })
          }}
        />
        <DateTimeInput
          dateOnly
          fullWidth
          disabled={disabled}
          label={t('analytics.params.to')}
          value={value.to ?? ''}
          onChange={(next) => {
            onChange({ ...value, to: toIsoDate(next) })
          }}
        />
      </div>
    </div>
  )
}
