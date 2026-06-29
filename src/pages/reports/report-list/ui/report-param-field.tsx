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

import type { ReportParameterDto } from '../types/report'

/**
 * Значение одного параметра в форме. Тип зависит от `dataType`:
 * - DATE      → string (ISO)
 * - ACCOUNT_LIST / REF_LIST (allowList) → number[] (ID записей)
 * - ACCOUNT_REF / DICTIONARY_REF / ENUM_REF → number (ID записи) | '' (черновик)
 * - BOOLEAN   → boolean
 * - NUMBER    → number | '' (черновик)
 * - STRING    → string
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

  // Источник опций для REF-типов. ACCOUNT_* берёт план счетов; остальные REF —
  // справочник по referenceDomain. Хуки вызываем безусловно (правила хуков),
  // включаем лениво по типу параметра.
  const isAccountRef =
    param.dataType === 'ACCOUNT_LIST' || param.dataType === 'ACCOUNT_REF'
  const isDictRef =
    param.dataType === 'DICTIONARY_REF' ||
    param.dataType === 'ENUM_REF' ||
    param.dataType === 'REF_LIST'

  // Счёт берётся из единого плана счетов (default). referenceDomain="ACCOUNT_PLAN" —
  // это маркер домена, а НЕ typeCode плана; передавать его в API нельзя (иначе
  // /api/account-plan/ACCOUNT_PLAN/entries → 404 «AccountPlan type not found»).
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

    case 'ACCOUNT_LIST':
    case 'REF_LIST': {
      // Множественный выбор; значение — массив ID записей (бэк ждёт id).
      const selectedIds = Array.isArray(value) ? value : []
      const selected = refOptions.filter((o) =>
        selectedIds.includes(Number(o.id))
      )
      return (
        <Autocomplete
          multiple
          size="small"
          options={refOptions}
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

    case 'ACCOUNT_REF':
    case 'DICTIONARY_REF':
    case 'ENUM_REF': {
      // Одиночный выбор из плана счетов / справочника; значение — id (number).
      const selected =
        value == null || value === ''
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
          value == null || value === ''
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
