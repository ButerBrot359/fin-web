import { useState, useEffect } from 'react'
import { Controller, type Control, useWatch } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { Checkbox } from '@mui/material'
import type { AxiosResponse } from 'axios'

import type { DocumentAttribute, EnumsValue } from '@/entities/document-type'
import { DICT_DATA_TYPES, getSearchUrl } from '@/shared/lib/consts/data-types'
import { apiService } from '@/shared/api/api'
import type { SelectOption } from '@/shared/types/select-option'
import { resolveSelectValue } from '@/shared/lib/utils/resolve-select-value'
import { TextInput } from '@/shared/ui/inputs/text-input'
import { NumberInput } from '@/shared/ui/inputs/number-input'
import { DateTimeInput } from '@/shared/ui/inputs/datetime-input'
import { AutocompleteInput } from '@/shared/ui/inputs/autocomplete-input'

interface TableCellRendererProps {
  name: string
  column: DocumentAttribute
  control: Control<Record<string, unknown>>
  language: string
}

interface DictionarySearchResponse {
  list: {
    id: number
    code: string
    displayName?: string
    nameRu?: string
    nameKz?: string
    [key: string]: unknown
  }[]
}

const DEBOUNCE_MS = 300

const DictCell = ({
  name,
  column,
  control,
  language,
}: TableCellRendererProps) => {
  const typeCode =
    column.referenceTypeCode ??
    (column.allowedTypes as { typeCode: string }[] | undefined)?.[0]
      ?.typeCode ??
    ''
  const searchUrl = typeCode
    ? (getSearchUrl(column.dataType, typeCode) ?? undefined)
    : undefined
  const isServerSearch = !!searchUrl

  const [opened, setOpened] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const fieldValue = useWatch({ control, name })
  const fieldValueId = (fieldValue as { id?: number | string } | null)?.id

  useEffect(() => {
    if (fieldValueId != null) {
      const resolved = resolveSelectValue(fieldValue, [])
      setInputValue(resolved?.label ?? '')
    } else {
      setInputValue('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldValueId])

  useEffect(() => {
    if (!isServerSearch) return
    const timer = setTimeout(() => {
      setDebouncedSearch(inputValue)
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [inputValue, isServerSearch])

  const { data: options = [], isFetching } = useQuery<
    AxiosResponse<DictionarySearchResponse>,
    unknown,
    SelectOption[]
  >({
    queryKey: ['dictionary-search', searchUrl, debouncedSearch],
    queryFn: () =>
      apiService.get<DictionarySearchResponse>({
        url: searchUrl!,
        params: { q: debouncedSearch, size: 30 },
      }),
    enabled: isServerSearch && opened,
    select: (response) =>
      response.data.list.map(
        (entry): SelectOption => ({
          id: entry.id,
          code: entry.code,
          label:
            entry.displayName ??
            (language === 'kz' && entry.nameKz ? entry.nameKz : entry.nameRu) ??
            entry.code,
          raw: entry as unknown as Record<string, unknown>,
        })
      ),
  })

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        const currentValue = resolveSelectValue(field.value, options)

        return (
          <AutocompleteInput
            value={currentValue}
            inputValue={isServerSearch ? inputValue : undefined}
            options={options}
            onChange={(newOption) => {
              field.onChange(newOption?.raw ?? null)
            }}
            onInputChange={
              isServerSearch
                ? (_e, value, reason) => {
                    if (reason !== 'reset') {
                      setInputValue(value)
                    }
                  }
                : undefined
            }
            onOpen={() => {
              setOpened(true)
            }}
            loading={isFetching}
            size="small"
          />
        )
      }}
    />
  )
}

const EnumCell = ({
  name,
  column,
  control,
}: Omit<TableCellRendererProps, 'language'>) => {
  const enumTypeCode =
    (column.allowedTypes as { typeCode: string }[] | undefined)?.[0]
      ?.typeCode ?? ''

  const [opened, setOpened] = useState(false)

  const toSelectOption = (item: EnumsValue): SelectOption => ({
    id: item.id,
    code: item.code,
    label: item.name,
    raw: item as unknown as Record<string, unknown>,
  })

  const { data: options = [], isFetching } = useQuery<
    AxiosResponse<EnumsValue[]>,
    unknown,
    SelectOption[]
  >({
    queryKey: ['enum-values', enumTypeCode],
    queryFn: () =>
      apiService.get<EnumsValue[]>({
        url: `/api/enums/${enumTypeCode}/values`,
      }),
    enabled: opened && !!enumTypeCode,
    staleTime: 5 * 60 * 1000,
    select: (response) => response.data.map(toSelectOption),
  })

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        const currentValue = resolveSelectValue(field.value, options)

        return (
          <AutocompleteInput
            value={currentValue}
            options={options}
            onChange={(newOption) => {
              field.onChange(newOption?.raw ?? null)
            }}
            onOpen={() => {
              setOpened(true)
            }}
            loading={isFetching}
            size="small"
          />
        )
      }}
    />
  )
}

export const TableCellRenderer = ({
  name,
  column,
  control,
  language,
}: TableCellRendererProps) => {
  const { dataType } = column

  if (DICT_DATA_TYPES.has(dataType)) {
    return (
      <DictCell
        name={name}
        column={column}
        control={control}
        language={language}
      />
    )
  }

  if (dataType === 'ENUMS') {
    return <EnumCell name={name} column={column} control={control} />
  }

  switch (dataType) {
    case 'STRING':
    case 'TEXT':
      return (
        <Controller
          name={name}
          control={control}
          render={({ field: { ref, ...field } }) => (
            <TextInput
              {...field}
              inputRef={ref}
              value={(field.value as string) || ''}
              size="small"
            />
          )}
        />
      )

    case 'INTEGER':
    case 'DECIMAL':
      return (
        <Controller
          name={name}
          control={control}
          render={({ field: { ref, onChange, ...field } }) => (
            <NumberInput
              {...field}
              onChange={onChange}
              inputRef={ref}
              value={field.value != null ? String(field.value as number) : ''}
              decimal={dataType === 'DECIMAL'}
              size="small"
            />
          )}
        />
      )

    case 'BOOLEAN':
      return (
        <Controller
          name={name}
          control={control}
          render={({ field }) => (
            <Checkbox
              checked={!!field.value}
              onChange={(e) => {
                field.onChange(e.target.checked)
              }}
              size="small"
              sx={{ p: 0 }}
            />
          )}
        />
      )

    case 'DATE':
    case 'DATETIME':
      return (
        <Controller
          name={name}
          control={control}
          render={({ field }) => (
            <DateTimeInput
              value={(field.value as string | undefined) ?? undefined}
              onChange={field.onChange}
              dateOnly={dataType === 'DATE'}
              size="small"
            />
          )}
        />
      )

    default:
      return (
        <Controller
          name={name}
          control={control}
          render={({ field: { ref, ...field } }) => (
            <TextInput
              {...field}
              inputRef={ref}
              value={(field.value as string) || ''}
              size="small"
            />
          )}
        />
      )
  }
}
