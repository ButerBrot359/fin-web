import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Autocomplete,
  Box,
  Checkbox,
  FormControlLabel,
  TextField,
  Typography,
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
          forcePopupIcon
          // Ширину задаёт контейнер строки параметров (w-72) — поле не шире
          // соседей и не наезжает на них (прежний фикс sx={{width:300}} вылезал
          // за контейнер). Высота — обычный tall-инпут темы (minHeight 44,
          // paddingTop 22) — как у дат и одиночных выпадашек.
          fullWidth
          sx={{
            // Длинная сводка обрезается внутри поля, а не «вылезает» за край
            // (тема задаёт inputRoot flexWrap:nowrap).
            '& .MuiFilledInput-root': { overflow: 'hidden' },
            '& .MuiAutocomplete-input': { minWidth: 24 },
            // При наборе (фокусе) прячем сводку — поле поиска на всю ширину.
            '& .MuiFilledInput-root.Mui-focused .reportalt-ms-summary': {
              display: 'none',
            },
          }}
          // Значение — компактная сводка «Имя (+N)» с многоточием (как в легаси
          // report-param-field): чипы при nowrap-теме вылезали за границу поля
          // и наезжали на соседний селект.
          renderValue={(tagValue) => {
            if (!Array.isArray(tagValue) || tagValue.length === 0) return null
            return (
              <Box
                component="span"
                className="reportalt-ms-summary"
                sx={{
                  // 22/6 — паддинги значения filled-инпута из темы: сводка
                  // садится на уровень значений соседних полей.
                  alignSelf: 'flex-start',
                  pt: '22px',
                  pb: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  minWidth: 0,
                  flexShrink: 1,
                  overflow: 'hidden',
                }}
              >
                <Typography
                  component="span"
                  sx={{
                    fontSize: 16,
                    fontWeight: 500,
                    lineHeight: 1.4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: '#222124',
                    minWidth: 0,
                  }}
                >
                  {tagValue[0].label}
                </Typography>
                {/* «+N» (сколько ещё выбрано) — всегда видно, не обрезается. */}
                {tagValue.length > 1 && (
                  <Typography
                    component="span"
                    sx={{
                      ml: 0.5,
                      fontSize: 16,
                      fontWeight: 500,
                      lineHeight: 1.4,
                      color: '#666',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    +{tagValue.length - 1}
                  </Typography>
                )}
              </Box>
            )
          }}
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
          fullWidth
        />
      )
  }
}
