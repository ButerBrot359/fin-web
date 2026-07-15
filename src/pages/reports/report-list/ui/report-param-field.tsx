import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Autocomplete,
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

  // Пул счетов «Списка счетов» ограничен счетами ОТЧЁТА (как в 1С — в выпадающем
  // списке только счета ордера, а не весь план счетов). Источник — defaultValue
  // параметра (ID счетов отчёта, задаётся бэком). Пусто ⇒ показываем весь план
  // (прежнее поведение для прочих ACCOUNT_LIST-параметров без дефолта).
  const allowedAccountIds = useMemo<Set<number> | null>(() => {
    if (param.dataType !== 'ACCOUNT_LIST') return null
    const def = param.defaultValue
    if (!Array.isArray(def) || def.length === 0) return null
    return new Set(def.map((v) => Number(v)))
  }, [param.dataType, param.defaultValue])

  const refOptions = useMemo<SelectOption[]>(() => {
    if (isAccountRef) {
      return accounts
        .filter((a) => !allowedAccountIds || allowedAccountIds.has(Number(a.id)))
        .map((a) => ({
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
  }, [isAccountRef, isDictRef, accounts, dictEntries, allowedAccountIds])

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
          // Отчёты 1С оперируют ДАТАМИ периода (без времени) — как в форме
          // отчёта 1С; убираем сегмент hh:mm (был DateTimePicker).
          dateOnly
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
          // Чекбоксы у каждой опции (как в 1С «Доступные организации»); список не
          // закрывается при выборе — можно отметить несколько подряд.
          disableCloseOnSelect
          size="small"
          // Всегда показывать стрелку-шеврон (аффорданс «раскрыть список»), а не
          // кликать по полю вслепую.
          forcePopupIcon
          sx={{
            // Фиксированная ширина, чтобы поле не растягивалось по шапке.
            width: 300,
            // Тема проекта делает endAdornment inline (position:static), поэтому длинный
            // тег выдавливал иконки за пределы поля (наезд на кнопку). Возвращаем
            // стандартное поведение MUI: иконки (очистить + стрелка) — абсолютом справа
            // (всегда видны), а теги/ввод — в одну строку с обрезкой и резервом справа,
            // чтобы не заходили под иконки и не вылезали за поле.
            '& .MuiAutocomplete-endAdornment': {
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
            },
            '& .MuiAutocomplete-inputRoot': {
              flexWrap: 'nowrap',
              overflow: 'hidden',
              paddingRight: '56px !important',
            },
            '& .MuiAutocomplete-input': { minWidth: 24 },
            // При наборе (фокусе) прячем сводку выбранного — поле поиска раскрывается
            // на всю ширину, текст поиска ровный и не зажат между значением и иконками.
            '& .MuiAutocomplete-inputRoot.Mui-focused .report-ms-summary': {
              display: 'none',
            },
          }}
          // Значение — компактная СВОДКА одной строкой («Имя» или «Имя (+N)») с
          // многоточием, а не чипы: не «вылезает» за поле и не зажимает поиск. При
          // фокусе (наборе) сводка скрывается (см. sx) — поле поиска на всю ширину.
          renderTags={(tagValue) => {
            if (tagValue.length === 0) return null
            return (
              <Typography
                component="span"
                variant="body2"
                className="report-ms-summary"
                sx={{
                  maxWidth: 210,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: '#333',
                }}
              >
                {tagValue.length === 1
                  ? tagValue[0].label
                  : `${tagValue[0].label} (+${tagValue.length - 1})`}
              </Typography>
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
          renderOption={(props, option, { selected }) => {
            const { key, ...optionProps } = props
            return (
              <li key={key} {...optionProps}>
                <Checkbox
                  size="small"
                  checked={selected}
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
