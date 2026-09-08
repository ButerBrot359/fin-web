import { useTranslation } from 'react-i18next'
import { Checkbox, FormControlLabel, MenuItem, Typography } from '@mui/material'

import type {
  AnalyticsAllowedValue,
  AnalyticsParameter,
} from '@/entities/analytics'
import { DateTimeInput, NumberInput, TextInput } from '@/shared/ui/inputs'

import type { AnalyticsDateRangeValue } from '../types/params'
import { toIsoDate } from '../lib/resolve-default-params'
import { ParamDateRangeField } from './param-date-range-field'

export interface ParamFieldProps {
  parameter: AnalyticsParameter
  value: unknown
  onChange: (value: unknown) => void
  disabled?: boolean
}

const isKz = (lang: string): boolean => {
  const normalized = lang.toLowerCase()
  return normalized.startsWith('kz') || normalized.startsWith('kk')
}

const labelOf = (
  source: { label?: string | null; labelKz?: string | null },
  fallback: string,
  lang: string
): string =>
  (isKz(lang) ? source.labelKz : source.label) ?? source.label ?? fallback

/** Текст значения для контрола: объекты в текстовое поле не попадают. */
const asText = (value: unknown): string => {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'bigint') {
    return value.toString()
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return ''
}

const asRange = (value: unknown): AnalyticsDateRangeValue => {
  if (value != null && typeof value === 'object') {
    const raw = value as { from?: unknown; to?: unknown }
    return { from: toIsoDate(raw.from), to: toIsoDate(raw.to) }
  }
  return { from: null, to: null }
}

/**
 * Контрол одного параметра по его типу из спецификации.
 *
 * Используются компоненты проекта из `@/shared/ui/inputs`, а не сырой
 * `TextField`: тема задаёт `MuiTextField` дефолты `variant: 'filled'` и
 * `fullWidth: true` и рассчитана именно на них. Своя ширина классом и
 * компактная высота ломают эту раскладку — плавающая подпись налезает на
 * значение. Ширину задаёт контейнер в панели параметров, поле всегда
 * `fullWidth`.
 *
 * По той же причине не ставится `size="small"`: у компактного размера отступ
 * сверху падает до 6px, плавающая подпись остаётся 16-м кеглем и наезжает на
 * значение — тот же дефект описан в комментарии легаси-поля отчётов.
 */
export const ParamField = ({
  parameter,
  value,
  onChange,
  disabled,
}: ParamFieldProps) => {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const label = labelOf(parameter, parameter.code, lang)

  if (parameter.type === 'DATE') {
    return (
      <DateTimeInput
        label={label}
        dateOnly
        fullWidth
        required={parameter.required}
        disabled={disabled}
        value={asText(value)}
        onChange={onChange}
      />
    )
  }

  if (parameter.type === 'DATE_RANGE') {
    return (
      <ParamDateRangeField
        label={label}
        value={asRange(value)}
        disabled={disabled}
        onChange={onChange}
      />
    )
  }

  if (parameter.type === 'BOOLEAN') {
    return (
      <FormControlLabel
        disabled={disabled}
        label={<Typography variant="body2">{label}</Typography>}
        control={
          <Checkbox
            size="small"
            checked={value === true}
            onChange={(event) => {
              onChange(event.target.checked)
            }}
          />
        }
      />
    )
  }

  if (parameter.type === 'ENUM') {
    const options: AnalyticsAllowedValue[] = parameter.allowedValues ?? []
    const selected = options.findIndex(
      (option) => asText(option.value) === asText(value)
    )
    return (
      <TextInput
        select
        fullWidth
        label={label}
        disabled={disabled}
        required={parameter.required}
        value={selected >= 0 ? String(selected) : ''}
        onChange={(event) => {
          const raw = event.target.value
          onChange(raw === '' ? null : options[Number(raw)].value)
        }}
      >
        {!parameter.required && (
          <MenuItem value="">{t('analytics.params.notSet')}</MenuItem>
        )}
        {options.map((option, index) => (
          <MenuItem key={index} value={String(index)}>
            {labelOf(option, asText(option.value), lang)}
          </MenuItem>
        ))}
      </TextInput>
    )
  }

  if (parameter.type === 'INTEGER' || parameter.type === 'DECIMAL') {
    return (
      <NumberInput
        fullWidth
        label={label}
        decimal={parameter.type === 'DECIMAL'}
        disabled={disabled}
        required={parameter.required}
        value={asText(value)}
        onChange={(event) => {
          onChange(event.target.value)
        }}
      />
    )
  }

  return (
    <TextInput
      fullWidth
      label={label}
      disabled={disabled}
      required={parameter.required}
      // DICTIONARY_REF: пикер справочника живёт в легаси-зоне, поэтому здесь
      // поле для кода или наименования записи.
      placeholder={
        parameter.type === 'DICTIONARY_REF'
          ? t('analytics.params.selectValue')
          : undefined
      }
      value={asText(value)}
      onChange={(event) => {
        onChange(event.target.value)
      }}
    />
  )
}
