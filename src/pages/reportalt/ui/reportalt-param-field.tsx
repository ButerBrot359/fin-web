import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Autocomplete,
  Checkbox,
  FormControlLabel,
  TextField,
} from '@mui/material'

import { useAccountPlanList } from '@/entities/account-plan'
import { useDictionaryEntries } from '@/shared/lib/dictionary-entry/use-dictionary-entries'
import {
  AutocompleteInput,
  DateTimeInput,
  NumberInput,
  TextInput,
} from '@/shared/ui/inputs'
import type { SelectOption } from '@/shared/types/select-option'

import type { ReportAltParameterDto } from '../types/reportalt'
import type { ReportAltParamValue } from '../lib/utils/params'

interface ReportAltParamFieldProps {
  param: ReportAltParameterDto
  value: ReportAltParamValue
  onChange: (value: ReportAltParamValue) => void
  /** Подсветить незаполненный обязательный параметр после «Сформировать». */
  invalid?: boolean
}

/**
 * Рендер одного параметра ReportAlt-отчёта по `dataType` (компактный аналог
 * легаси `report-param-field`). PERIOD здесь не рендерится — страница
 * раскрывает его в пару полей from/to.
 */
export const ReportAltParamField = ({
  param,
  value,
  onChange,
  invalid,
}: ReportAltParamFieldProps) => {
  const { t, i18n } = useTranslation()
  const isKz = i18n.language === 'kz'
  const label = (isKz ? param.titleKz : param.titleRu) || param.titleRu

  // Источник опций REF-типов: ACCOUNT_* — план счетов; прочие REF — справочник
  // по referenceDomain. Хуки вызываем безусловно (правила хуков), включаем
  // лениво по типу параметра.
  const isAccountRef =
    param.dataType === 'ACCOUNT_LIST' || param.dataType === 'ACCOUNT_REF'
  const isDictRef =
    param.dataType === 'DICTIONARY_REF' ||
    param.dataType === 'ENUM_REF' ||
    param.dataType === 'REF_LIST'

  // referenceDomain="ACCOUNT_PLAN" — маркер домена, а не typeCode плана.
  const accountTypeCode =
    param.referenceDomain && param.referenceDomain !== 'ACCOUNT_PLAN'
      ? param.referenceDomain
      : undefined
  const { entries: accounts } = useAccountPlanList({
    typeCode: accountTypeCode,
    enabled: isAccountRef,
  })
  const { entries: dictEntries } = useDictionaryEntries(
    isDictRef ? (param.referenceDomain ?? null) : null
  )

  const refOptions = useMemo<SelectOption[]>(() => {
    if (isAccountRef) {
      return accounts.map((a) => ({
        id: a.id,
        code: a.code,
        label: a.nameRu ? `${a.code} — ${a.nameRu}` : a.code,
      }))
    }
    if (isDictRef) {
      return dictEntries.map((e) => ({
        id: e.id,
        code: e.code ?? '',
        label: e.displayName ?? e.nameRu ?? e.code ?? String(e.id),
      }))
    }
    return []
  }, [isAccountRef, isDictRef, accounts, dictEntries])

  switch (param.dataType) {
    case 'DATE':
    case 'PERIOD':
      return (
        <DateTimeInput
          value={typeof value === 'string' ? value : ''}
          onChange={(v) => {
            onChange(v)
          }}
          label={label}
          dateOnly
          required={param.required}
          error={invalid}
          size="small"
          fullWidth
        />
      )

    case 'ACCOUNT_LIST':
    case 'REF_LIST': {
      // Множественный выбор; значение — массив ID записей.
      const selectedIds = Array.isArray(value) ? value : []
      const selected = refOptions.filter((o) =>
        selectedIds.includes(Number(o.id))
      )
      return (
        <Autocomplete
          multiple
          disableCloseOnSelect
          size="small"
          forcePopupIcon
          sx={{ width: 300 }}
          options={refOptions}
          value={selected}
          onChange={(_e, next) => {
            onChange(next.map((o) => Number(o.id)))
          }}
          getOptionLabel={(o) => o.label}
          isOptionEqualToValue={(o, v) => o.id === v.id}
          noOptionsText={t('inputs.noOptions')}
          renderOption={(props, option, { selected: isSelected }) => {
            const { key, ...optionProps } = props
            return (
              <li key={key} {...optionProps}>
                <Checkbox
                  size="small"
                  checked={isSelected}
                  sx={{ mr: 1, p: 0.5 }}
                />
                {option.label}
              </li>
            )
          }}
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

    case 'ACCOUNT_REF':
    case 'DICTIONARY_REF':
    case 'ENUM_REF': {
      // Одиночный выбор; значение — id записи (number).
      const selected =
        value == null || value === '' || typeof value === 'object'
          ? null
          : (refOptions.find((o) => Number(o.id) === Number(value)) ?? null)
      return (
        <AutocompleteInput
          value={selected}
          options={refOptions}
          onChange={(o) => {
            onChange(o ? Number(o.id) : '')
          }}
          label={label}
          required={param.required}
          error={invalid}
          size="small"
          fullWidth
        />
      )
    }

    case 'NUMBER': {
      // NUMBER с фиксированным списком (напр. периодичность) — выпадашка.
      if (param.allowedValues && param.allowedValues.length > 0) {
        const options = param.allowedValues.map<SelectOption>((av) => ({
          id: av.value,
          code: String(av.value),
          label: (isKz ? av.titleKz : av.titleRu) || av.titleRu,
        }))
        const selected =
          value == null || value === '' || typeof value === 'object'
            ? null
            : (options.find((o) => Number(o.id) === Number(value)) ?? null)
        return (
          <AutocompleteInput
            value={selected}
            options={options}
            onChange={(o) => {
              onChange(o ? Number(o.id) : '')
            }}
            label={label}
            required={param.required}
            error={invalid}
            size="small"
            fullWidth
          />
        )
      }
      return (
        <NumberInput
          value={
            value == null || typeof value === 'object' ? '' : String(value)
          }
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

    case 'STRING': {
      // STRING с фиксированным списком (напр. язык формы МО YazykFormy:
      // Ru/Kz) — выпадашка с подписями titleRu/titleKz из allowedValues.
      if (param.allowedValues && param.allowedValues.length > 0) {
        const options = param.allowedValues.map<SelectOption>((av) => ({
          id: String(av.value),
          code: String(av.value),
          label: (isKz ? av.titleKz : av.titleRu) || av.titleRu,
        }))
        const selected =
          typeof value === 'string' && value !== ''
            ? (options.find((o) => o.id === value) ?? null)
            : null
        return (
          <AutocompleteInput
            value={selected}
            options={options}
            onChange={(o) => {
              onChange(o ? String(o.id) : '')
            }}
            label={label}
            required={param.required}
            error={invalid}
            size="small"
            fullWidth
          />
        )
      }
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
