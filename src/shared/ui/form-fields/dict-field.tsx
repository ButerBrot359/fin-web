import { useState, useEffect } from 'react'
import { Controller, type Control } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import type { AxiosResponse } from 'axios'
import { IconButton } from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { useTranslation } from 'react-i18next'

import { apiService } from '@/shared/api/api'
import type { SelectOption } from '@/shared/types/select-option'
import { resolveSelectValue } from '@/shared/lib/utils/resolve-select-value'
import { AutocompleteInput } from '@/shared/ui/inputs/autocomplete-input'

interface DictionaryEntry {
  id: number
  code: string
  displayName?: string
  nameRu?: string
  nameKz?: string
  [key: string]: unknown
}

interface DictionarySearchResponse {
  list: DictionaryEntry[]
}

interface DictFieldProps {
  name: string
  label: string
  control: Control<Record<string, unknown>>
  readOnly?: boolean
  disabled?: boolean
  required?: string
  options?: SelectOption[]
  searchUrl?: string
  searchParams?: Record<string, string>
  loading?: boolean
  onValueChange?: () => void
  onShowAll?: (onSelect: (value: SelectOption) => void) => void
  onAdd?: () => void
}

const DEBOUNCE_MS = 300

export const DictField = ({
  name,
  label,
  control,
  readOnly,
  disabled,
  options: staticOptions,
  required,
  searchUrl,
  searchParams,
  loading: externalLoading,
  onValueChange,
  onShowAll,
  onAdd,
}: DictFieldProps) => {
  const { i18n } = useTranslation()
  const [opened, setOpened] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const isServerSearch = !!searchUrl

  useEffect(() => {
    if (!isServerSearch) return
    const timer = setTimeout(() => {
      setDebouncedSearch(inputValue)
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [inputValue, isServerSearch])

  const { data: serverOptions = [], isFetching } = useQuery<
    AxiosResponse<DictionarySearchResponse>,
    unknown,
    SelectOption[]
  >({
    queryKey: ['dictionary-search', searchUrl, debouncedSearch, searchParams],
    queryFn: () =>
      apiService.get<DictionarySearchResponse>({
        url: searchUrl!,
        params: { q: debouncedSearch, size: 30, ...searchParams },
      }),
    enabled: isServerSearch && opened,
    select: (response) =>
      response.data.list.map(
        (entry): SelectOption => ({
          id: entry.id,
          code: entry.code,
          label:
            entry.displayName ??
            (i18n.language === 'kz' && entry.nameKz
              ? entry.nameKz
              : entry.nameRu) ??
            entry.code,
          raw: entry as unknown as Record<string, unknown>,
        })
      ),
  })

  const options = isServerSearch ? serverOptions : (staticOptions ?? [])
  const loading = isServerSearch ? isFetching : externalLoading

  return (
    <Controller
      name={name}
      control={control}
      rules={{ required }}
      render={({ field, fieldState }) => {
        const currentValue = resolveSelectValue(field.value, options)

        const handleShowAll = onShowAll
          ? () => {
              onShowAll((val: SelectOption) => {
                field.onChange(val.raw ?? null)
                onValueChange?.()
              })
            }
          : undefined

        const endAction = (
          <IconButton sx={{ p: '4px', borderRadius: '6px' }} tabIndex={-1}>
            <ContentCopyIcon className="text-ui-05" sx={{ fontSize: 20 }} />
          </IconButton>
        )

        return (
          <AutocompleteInput
            value={currentValue}
            options={options}
            onChange={(newOption) => {
              field.onChange(newOption?.raw ?? null)
              onValueChange?.()
            }}
            onInputChange={
              isServerSearch
                ? (_e, value, reason) => {
                    if (reason === 'input') {
                      setInputValue(value)
                    }
                  }
                : undefined
            }
            onOpen={() => {
              setOpened(true)
            }}
            label={label}
            readOnly={readOnly}
            disabled={disabled}
            required={!!required}
            loading={loading}
            error={!!fieldState.error}
            helperText={fieldState.error?.message}
            endAction={endAction}
            onShowAll={handleShowAll}
            onAdd={onAdd}
          />
        )
      }}
    />
  )
}
