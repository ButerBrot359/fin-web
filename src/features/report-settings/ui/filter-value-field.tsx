import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Autocomplete, TextField } from '@mui/material'
import { useQuery } from '@tanstack/react-query'

import { apiService } from '@/shared/api/api'
import { useDictionaryEntries } from '@/shared/lib/dictionary-entry/use-dictionary-entries'
import {
  AutocompleteInput,
  DateTimeInput,
  NumberInput,
  TextInput,
} from '@/shared/ui/inputs'
import type { SelectOption } from '@/shared/types/select-option'

/** Разобранный тип значения отбора (из `valueType` бэка). */
type ValueKind =
  | 'DICTIONARY'
  | 'ENUM'
  | 'REF' // DOCUMENT / ANY_REF / неизвестная ссылка → ввод ID
  | 'STRING'
  | 'INTEGER'
  | 'DECIMAL'
  | 'BOOLEAN'
  | 'DATE'

/** Определяет вид пикера по `valueType` (`REF:DICTIONARY:…` / примитив / …). */
const resolveValueKind = (valueType?: string): ValueKind => {
  if (!valueType) return 'REF'
  if (valueType.startsWith('REF:DICTIONARY:')) return 'DICTIONARY'
  if (valueType.startsWith('REF:ENUM:')) return 'ENUM'
  if (valueType.startsWith('REF:DOCUMENT:') || valueType === 'ANY_REF') {
    return 'REF'
  }
  switch (valueType) {
    case 'STRING':
      return 'STRING'
    case 'INTEGER':
      return 'INTEGER'
    case 'DECIMAL':
      return 'DECIMAL'
    case 'BOOLEAN':
      return 'BOOLEAN'
    case 'DATE':
      return 'DATE'
    default:
      return 'REF'
  }
}

interface FilterValueFieldProps {
  /** Тип значения отбора (`REF:DICTIONARY:<typeCode>` / примитив / ANY_REF). */
  valueType?: string
  /** typeCode справочника/перечисления-источника (для DICTIONARY/ENUM). */
  referenceDomain?: string
  /** Множественный выбор (multi-поле либо сравнение «В списке»). */
  multi: boolean
  /** Текущие значения (ID записей либо примитивы). */
  values: (number | string)[]
  onChange: (values: (number | string)[]) => void
  label: string
}

/**
 * Пикер значения одной строки отбора: по `valueType`/`referenceDomain` строит
 * нужный контрол (справочник-автокомплит, перечисление, примитив или ввод ID).
 * Переиспользует общий `useDictionaryEntries`; значения перечислений грузит
 * ленивым запросом `/api/enums/{code}/values`. Значения хранит как массив ID
 * (для мультивыбора — несколько), примитивы — как единственный элемент.
 */
export const FilterValueField = ({
  valueType,
  referenceDomain,
  multi,
  values,
  onChange,
  label,
}: FilterValueFieldProps) => {
  const { t } = useTranslation()
  const kind = resolveValueKind(valueType)

  // Справочник (DICTIONARY) — общий хук; включается только для нужного вида.
  const dictTypeCode = kind === 'DICTIONARY' ? (referenceDomain ?? null) : null
  const { entries } = useDictionaryEntries(dictTypeCode)

  // Перечисление (ENUM) — ленивый запрос значений по коду типа.
  const { data: enumOptions = [] } = useQuery({
    queryKey: ['report-enum-values', referenceDomain],
    queryFn: ({ signal }) =>
      apiService.get<{ id: number; code: string; name: string }[]>({
        url: `/api/enums/${referenceDomain ?? ''}/values`,
        signal,
      }),
    enabled: kind === 'ENUM' && !!referenceDomain,
    staleTime: 5 * 60 * 1000,
    select: (res): SelectOption[] =>
      res.data.map((e) => ({ id: e.id, code: e.code, label: e.name })),
  })

  const options = useMemo<SelectOption[]>(() => {
    if (kind === 'DICTIONARY') {
      return entries.map((e) => ({
        id: e.id,
        code: e.code ?? '',
        label: e.displayName ?? e.nameRu ?? e.code ?? String(e.id),
      }))
    }
    if (kind === 'ENUM') return enumOptions
    return []
  }, [kind, entries, enumOptions])

  // ── Ссылочные значения из справочника/перечисления ──────────────────────
  if (kind === 'DICTIONARY' || kind === 'ENUM') {
    if (multi) {
      const selected = options.filter((o) => values.includes(Number(o.id)))
      return (
        <Autocomplete
          multiple
          size="small"
          fullWidth
          options={options}
          value={selected}
          onChange={(_e, next) => {
            onChange(next.map((o) => Number(o.id)))
          }}
          getOptionLabel={(o) => o.label}
          isOptionEqualToValue={(o, v) => o.id === v.id}
          noOptionsText={t('inputs.noOptions')}
          renderInput={(params) => <TextField {...params} label={label} />}
        />
      )
    }
    const selected =
      values.length > 0
        ? (options.find((o) => Number(o.id) === Number(values[0])) ?? null)
        : null
    return (
      <AutocompleteInput
        value={selected}
        options={options}
        onChange={(o) => {
          onChange(o ? [Number(o.id)] : [])
        }}
        label={label}
        size="small"
        fullWidth
      />
    )
  }

  // ── Примитивы ───────────────────────────────────────────────────────────
  const single = values.length > 0 ? values[0] : ''

  if (kind === 'DATE') {
    return (
      <DateTimeInput
        value={typeof single === 'string' ? single : ''}
        onChange={(v) => {
          onChange(v ? [v] : [])
        }}
        label={label}
        dateOnly
        size="small"
        fullWidth
      />
    )
  }

  if (kind === 'STRING') {
    return (
      <TextInput
        value={typeof single === 'string' ? single : String(single)}
        onChange={(e) => {
          onChange(e.target.value ? [e.target.value] : [])
        }}
        label={label}
        size="small"
        fullWidth
      />
    )
  }

  // INTEGER / DECIMAL / REF (ID ссылки без пикера) — числовой ввод.
  return (
    <NumberInput
      value={single === '' ? '' : String(single)}
      onChange={(e) => {
        const raw = e.target.value
        onChange(raw === '' ? [] : [Number(raw)])
      }}
      label={label}
      size="small"
      fullWidth
    />
  )
}
