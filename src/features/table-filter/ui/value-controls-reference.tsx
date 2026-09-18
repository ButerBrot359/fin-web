import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MenuItem, TextField } from '@mui/material'

import { AutocompleteInput } from '@/shared/ui/inputs/autocomplete-input'
import {
  REFERENCE_DOMAIN_KINDS,
  getUniversalSearchUrl,
} from '@/shared/lib/consts/data-types'
import type { SelectOption } from '@/shared/types/select-option'

import { useDebouncedValue } from '../lib/hooks/use-debounced-value'
import { useDictionarySearch } from '../lib/hooks/use-dictionary-search'
import { useEnumValues } from '../lib/hooks/use-enum-values'

import type { ValueControlProps } from './value-controls-primitives'

export const DictionaryControl = ({
  value,
  onChange,
  column,
}: ValueControlProps) => {
  const { t } = useTranslation()
  const [opened, setOpened] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const debounced = useDebouncedValue(inputValue, 300)

  const typeCode = column.referencedTypeCode
  const domain = column.referencedDomainKind ?? column.dataType
  const url =
    typeCode && REFERENCE_DOMAIN_KINDS.has(domain)
      ? getUniversalSearchUrl(domain, typeCode)
      : null

  const { data: options = [], isFetching } = useDictionarySearch(
    url,
    opened,
    debounced
  )

  const currentValue: SelectOption | null =
    value && typeof value === 'object' && 'id' in value
      ? (value as SelectOption)
      : null

  return (
    <AutocompleteInput
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

export const EnumsControl = ({
  value,
  onChange,
  column,
}: ValueControlProps) => {
  const { t } = useTranslation()
  const [opened, setOpened] = useState(false)
  const enumTypeCode = column.referencedTypeCode

  const { data: options = [] } = useEnumValues(enumTypeCode, opened)

  const rawId: unknown =
    value && typeof value === 'object' && 'id' in value
      ? (value as { id: number | string }).id
      : value
  const currentId =
    typeof rawId === 'number' || typeof rawId === 'string' ? String(rawId) : ''

  return (
    <TextField
      select
      fullWidth
      label={t('tableFilter.value')}
      value={currentId}
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
        <MenuItem key={o.id} value={String(o.id)}>
          {o.name}
        </MenuItem>
      ))}
    </TextField>
  )
}
