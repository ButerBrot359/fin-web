import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Autocomplete,
  Checkbox,
  FormControlLabel,
  TextField,
} from '@mui/material'

import { useAccountPlanList } from '@/entities/account-plan'
import { DateTimeInput, NumberInput, TextInput } from '@/shared/ui/inputs'
import type { SelectOption } from '@/shared/types/select-option'

import type { ReportParameterDto } from '../types/report'

/**
 * Значение одного параметра в форме. Тип зависит от `dataType`:
 * - DATE      → string (ISO)
 * - ACCOUNT_LIST (allowList) → number[] (ID записей счетов)
 * - BOOLEAN   → boolean
 * - NUMBER    → number | '' (черновик)
 * - STRING / DICTIONARY_REF → string
 */
export type ReportParamValue =
  | string
  | number
  | boolean
  | number[]
  | null
  | undefined

interface ReportParamFieldProps {
  param: ReportParameterDto
  value: ReportParamValue
  onChange: (value: ReportParamValue) => void
  /** Подсветить незаполненный обязательный параметр после попытки «Сформировать». */
  invalid?: boolean
}

/**
 * Рендер одного параметра отчёта по его типу (`dataType`). Универсальная форма
 * параметров собирается из таких полей по `meta.parameters`. Заголовок —
 * локализованный (`titleKz`/`titleRu`).
 */
export const ReportParamField = ({
  param,
  value,
  onChange,
  invalid,
}: ReportParamFieldProps) => {
  const { t, i18n } = useTranslation()
  const isKz = i18n.language === 'kz'
  const label = (isKz ? param.titleKz : param.titleRu) || param.titleRu

  // Опции счетов нужны только для ACCOUNT_LIST — грузим лениво (enabled).
  const isAccountList = param.dataType === 'ACCOUNT_LIST'
  const { entries: accounts } = useAccountPlanList({ enabled: isAccountList })
  const accountOptions = useMemo<SelectOption[]>(
    () =>
      accounts.map((a) => ({
        id: a.id,
        code: a.code,
        label: a.nameRu ? `${a.code} — ${a.nameRu}` : a.code,
      })),
    [accounts]
  )

  switch (param.dataType) {
    case 'DATE':
    case 'PERIOD':
      // PERIOD как одиночное поле здесь не используется (страница раскрывает его
      // в пару from/to по именам параметров); одиночный DATE — обычный пикер.
      return (
        <DateTimeInput
          value={typeof value === 'string' ? value : ''}
          onChange={(v) => {
            onChange(v)
          }}
          label={label}
          required={param.required}
          error={invalid}
          size="small"
          fullWidth
        />
      )

    case 'ACCOUNT_LIST': {
      // Множественный выбор счетов; значение — массив ID записей (бэк ждёт id).
      const selectedIds = Array.isArray(value) ? value : []
      const selected = accountOptions.filter((o) =>
        selectedIds.includes(Number(o.id))
      )
      return (
        <Autocomplete
          multiple
          size="small"
          options={accountOptions}
          value={selected}
          onChange={(_e, next) => {
            onChange(next.map((o) => Number(o.id)))
          }}
          getOptionLabel={(o) => o.label}
          isOptionEqualToValue={(o, v) => o.id === v.id}
          noOptionsText={t('inputs.noOptions')}
          renderInput={(params) => (
            <TextField
              {...params}
              label={label}
              required={param.required}
              error={invalid}
            />
          )}
        />
      )
    }

    case 'BOOLEAN':
      return (
        <FormControlLabel
          control={
            <Checkbox
              checked={value === true}
              onChange={(e) => {
                onChange(e.target.checked)
              }}
            />
          }
          label={label}
        />
      )

    case 'NUMBER':
      return (
        <NumberInput
          value={value == null ? '' : String(value)}
          onChange={(e) => {
            const raw = e.target.value
            onChange(raw === '' ? '' : Number(raw))
          }}
          label={label}
          required={param.required}
          error={invalid}
          size="small"
          fullWidth
        />
      )

    // DICTIONARY_REF — TODO: подключить выбор из справочника по типу.
    // Пока текстовый ввод (id/код), чтобы не блокировать форму.
    case 'DICTIONARY_REF':
    case 'STRING':
    default:
      return (
        <TextInput
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => {
            onChange(e.target.value)
          }}
          label={label}
          required={param.required}
          error={invalid}
          size="small"
          fullWidth
        />
      )
  }
}
