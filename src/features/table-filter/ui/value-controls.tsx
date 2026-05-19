import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Box,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import type { AxiosResponse } from 'axios'

import type { ColumnMetaDto, FilterOp } from '@/entities/document-entry'
import { apiService } from '@/shared/api/api'
import { DateTimeInput } from '@/shared/ui/inputs/datetime-input'
import { NumberInput } from '@/shared/ui/inputs/number-input'
import { AutocompleteInput } from '@/shared/ui/inputs/autocomplete-input'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'
import {
  REFERENCE_DOMAIN_KINDS,
  getUniversalSearchUrl,
} from '@/shared/lib/consts/data-types'
import type { SelectOption } from '@/shared/types/select-option'
import type { EnumsValue } from '@/entities/document-type'

import { useDebouncedValue } from '../lib/hooks/use-debounced-value'
import { normalizeDateForBackend } from '../lib/utils/normalize-date-value'

import { isListOp, isRangeOp } from './value-controls.utils'

interface ValueControlProps {
  column: ColumnMetaDto
  op: FilterOp
  value: unknown
  onChange: (next: unknown) => void
}

const StringControl = ({ value, onChange }: ValueControlProps) => {
  const { t } = useTranslation()
  return (
    <TextField
      size="small"
      fullWidth
      label={t('tableFilter.value')}
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => {
        onChange(e.target.value)
      }}
    />
  )
}

const StringListControl = ({ value, onChange }: ValueControlProps) => {
  const { t } = useTranslation()
  const raw = Array.isArray(value) ? value.join(', ') : ''
  return (
    <TextField
      size="small"
      fullWidth
      label={t('tableFilter.value')}
      placeholder="a, b, c"
      value={raw}
      onChange={(e) => {
        const parts = e.target.value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
        onChange(parts)
      }}
    />
  )
}

const NumberControl = ({ value, onChange, column }: ValueControlProps) => {
  const { t } = useTranslation()
  return (
    <NumberInput
      size="small"
      fullWidth
      label={t('tableFilter.value')}
      decimal={column.dataType === 'DECIMAL'}
      value={typeof value === 'number' ? String(value) : typeof value === 'string' ? value : ''}
      onChange={(e) => {
        const v = (e.target as HTMLInputElement).value
        onChange(v === '' ? null : Number(v))
      }}
    />
  )
}

const NumberRangeControl = ({ value, onChange, column }: ValueControlProps) => {
  const { t } = useTranslation()
  const [from, to] = Array.isArray(value) ? value : [null, null]
  return (
    <Box className="flex gap-3">
      <NumberInput
        size="small"
        fullWidth
        label={t('tableFilter.valueFrom')}
        decimal={column.dataType === 'DECIMAL'}
        value={from == null ? '' : String(from)}
        onChange={(e) => {
          const v = (e.target as HTMLInputElement).value
          onChange([v === '' ? null : Number(v), to ?? null])
        }}
      />
      <NumberInput
        size="small"
        fullWidth
        label={t('tableFilter.valueTo')}
        decimal={column.dataType === 'DECIMAL'}
        value={to == null ? '' : String(to)}
        onChange={(e) => {
          const v = (e.target as HTMLInputElement).value
          onChange([from ?? null, v === '' ? null : Number(v)])
        }}
      />
    </Box>
  )
}

const edgeForSingleOp = (op: FilterOp): 'start' | 'end' =>
  op === 'lt' || op === 'lte' ? 'end' : 'start'

const DateControl = ({ value, op, onChange, column }: ValueControlProps) => {
  const { t } = useTranslation()
  const edge = edgeForSingleOp(op)
  return (
    <DateTimeInput
      size="small"
      dateOnly
      label={t('tableFilter.value')}
      value={typeof value === 'string' ? value : ''}
      onChange={(v) => {
        onChange(normalizeDateForBackend(v, column.dataType, edge))
      }}
    />
  )
}

const DateRangeControl = ({ value, onChange, column }: ValueControlProps) => {
  const { t } = useTranslation()
  const [from, to] = Array.isArray(value) ? value : ['', '']
  return (
    <Box className="flex gap-3">
      <DateTimeInput
        size="small"
        dateOnly
        label={t('tableFilter.valueFrom')}
        value={typeof from === 'string' ? from : ''}
        onChange={(v) => {
          onChange([
            normalizeDateForBackend(v, column.dataType, 'start'),
            to ?? '',
          ])
        }}
      />
      <DateTimeInput
        size="small"
        dateOnly
        label={t('tableFilter.valueTo')}
        value={typeof to === 'string' ? to : ''}
        onChange={(v) => {
          onChange([
            from ?? '',
            normalizeDateForBackend(v, column.dataType, 'end'),
          ])
        }}
      />
    </Box>
  )
}

const BooleanControl = ({ value, onChange }: ValueControlProps) => {
  const { t } = useTranslation()
  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={value === null || value === undefined ? null : value}
      onChange={(_e, next) => {
        if (next === null) return
        onChange(next)
      }}
    >
      <ToggleButton value={true}>{t('tableFilter.yes')}</ToggleButton>
      <ToggleButton value={false}>{t('tableFilter.no')}</ToggleButton>
    </ToggleButtonGroup>
  )
}

interface DictionaryEntry {
  id: number
  code: string
  displayName?: string
  nameRu?: string
  nameKz?: string
}
interface DictionarySearchResponse {
  data: { content: DictionaryEntry[] }
  success: boolean
}

const DictionaryControl = ({ value, onChange, column }: ValueControlProps) => {
  const { t, i18n } = useTranslation()
  const [opened, setOpened] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const debounced = useDebouncedValue(inputValue, 300)

  const typeCode = column.referencedTypeCode
  const domain = column.referencedDomainKind ?? column.dataType
  const url =
    typeCode && REFERENCE_DOMAIN_KINDS.has(domain)
      ? getUniversalSearchUrl(domain, typeCode)
      : null

  const { data: options = [], isFetching } = useQuery<
    AxiosResponse<DictionarySearchResponse>,
    unknown,
    SelectOption[]
  >({
    queryKey: ['filter-dict-search', url, debounced],
    queryFn: () =>
      apiService.get<DictionarySearchResponse>({
        url: url!,
        params: { q: debounced, size: 30 },
      }),
    enabled: !!url && opened,
    select: (response) =>
      response.data.data.content.map(
        (entry): SelectOption => ({
          id: entry.id,
          code: entry.code,
          label:
            (entry.displayName ?? getLocalizedName(entry, i18n.language)) ||
            entry.code,
          raw: entry as unknown as Record<string, unknown>,
        })
      ),
  })

  const currentValue: SelectOption | null =
    value && typeof value === 'object' && 'id' in value
      ? (value as SelectOption)
      : null

  return (
    <AutocompleteInput
      size="small"
      value={currentValue}
      inputValue={inputValue}
      options={options}
      loading={isFetching}
      label={t('tableFilter.value')}
      onOpen={() => {
        setOpened(true)
      }}
      onInputChange={(_e, v, reason) => {
        if (reason !== 'reset') setInputValue(v)
      }}
      onChange={(opt) => {
        if (!opt) onChange(null)
        else onChange({ id: opt.id, code: opt.code, label: opt.label })
      }}
    />
  )
}

const EnumsControl = ({ value, onChange, column }: ValueControlProps) => {
  const { t } = useTranslation()
  const [opened, setOpened] = useState(false)
  const enumTypeCode = column.referencedTypeCode

  const { data: options = [] } = useQuery<
    AxiosResponse<EnumsValue[]>,
    unknown,
    EnumsValue[]
  >({
    queryKey: ['filter-enum-values', enumTypeCode],
    queryFn: () =>
      apiService.get<EnumsValue[]>({
        url: `/api/enums/${enumTypeCode!}/values`,
      }),
    enabled: !!enumTypeCode && opened,
    staleTime: 5 * 60 * 1000,
    select: (response) => response.data,
  })

  const currentId =
    value && typeof value === 'object' && 'id' in value
      ? (value as { id: number | string }).id
      : value

  return (
    <TextField
      select
      size="small"
      fullWidth
      label={t('tableFilter.value')}
      value={currentId ?? ''}
      onFocus={() => {
        setOpened(true)
      }}
      onChange={(e) => {
        const id = e.target.value
        const found = options.find((o) => String(o.id) === id)
        if (!found) onChange(null)
        else
          onChange({
            id: found.id,
            code: found.code,
            label: found.name,
          })
      }}
    >
      {options.map((o) => (
        <MenuItem key={o.id} value={o.id}>
          {o.name}
        </MenuItem>
      ))}
    </TextField>
  )
}

export const ValueControl = (props: ValueControlProps) => {
  const { op, column } = props

  if (op === 'isNull' || op === 'isNotNull') return null

  const isRange = isRangeOp(op)
  const isList = isListOp(op)

  switch (column.dataType) {
    case 'STRING':
    case 'TEXT':
      return isList ? <StringListControl {...props} /> : <StringControl {...props} />

    case 'INTEGER':
    case 'DECIMAL':
      if (isRange) return <NumberRangeControl {...props} />
      if (isList) return <StringListControl {...props} />
      return <NumberControl {...props} />

    case 'DATE':
    case 'DATETIME':
      return isRange ? <DateRangeControl {...props} /> : <DateControl {...props} />

    case 'BOOLEAN':
      return <BooleanControl {...props} />

    case 'DICTIONARY':
    case 'DOCUMENT':
    case 'ACCOUNT_PLAN':
    case 'CHARACTERISTICS_PLAN':
    case 'EXCHANGE_PLAN':
    case 'CALCULATION_PLAN':
      return <DictionaryControl {...props} />

    case 'ENUMS':
      return <EnumsControl {...props} />

    default:
      return null
  }
}
