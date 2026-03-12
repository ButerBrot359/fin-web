import { useState, useEffect } from 'react'
import { Controller, type Control } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { apiService } from '@/shared/api/api'
import type { SelectOption } from '@/shared/types/select-option'
import { ReferenceInput } from '@/shared/ui/inputs/reference-input'

interface DictionaryEntry {
  id: number
  code: string
  nameRu: string
  nameKz: string
  [key: string]: unknown
}

interface DictionarySearchResponse {
  list: DictionaryEntry[]
}

interface DictionaryFieldProps {
  name: string
  label: string
  control: Control<Record<string, unknown>>
  readOnly?: boolean
  referenceTypeCode: string
}

const DEBOUNCE_MS = 300

export const DictionaryField = ({
  name,
  label,
  control,
  readOnly,
  referenceTypeCode,
}: DictionaryFieldProps) => {
  const { i18n } = useTranslation()
  const [inputValue, setInputValue] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(inputValue)
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [inputValue])

  const { data: options = [], isFetching } = useQuery({
    queryKey: ['dictionary-search', referenceTypeCode, debouncedSearch],
    queryFn: () =>
      apiService.get<DictionarySearchResponse>({
        url: `/api/dictionaries/entries/${referenceTypeCode}/search`,
        params: { q: debouncedSearch, size: 30 },
      }),
    enabled: true,
    select: (response) =>
      response.data.list.map(
        (entry): SelectOption => ({
          id: entry.id,
          code: entry.code,
          label:
            i18n.language === 'kz' && entry.nameKz
              ? entry.nameKz
              : entry.nameRu,
          raw: entry as unknown as Record<string, unknown>,
        })
      ),
  })

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const raw = field.value as Record<string, unknown> | null | undefined
        const currentValue =
          options.find((opt) => {
            if (!raw) return false
            if (typeof raw === 'object' && 'id' in raw) return opt.id === raw.id
            return false
          }) ??
          (raw && typeof raw === 'object' && 'id' in raw
            ? {
                id: raw.id as number,
                code: typeof raw.code === 'string' ? raw.code : '',
                label:
                  typeof raw.nameRu === 'string'
                    ? raw.nameRu
                    : typeof raw.name === 'string'
                      ? raw.name
                      : '',
                raw,
              }
            : null)

        return (
          <ReferenceInput
            value={currentValue}
            options={options}
            onChange={(newOption) => {
              field.onChange(newOption?.raw ?? null)
            }}
            onInputChange={(_e, value, reason) => {
              if (reason === 'input') {
                setInputValue(value)
              }
            }}
            label={label}
            readOnly={readOnly}
            loading={isFetching}
            error={!!fieldState.error}
            helperText={fieldState.error?.message}
          />
        )
      }}
    />
  )
}
