import { useState } from 'react'
import { Controller, type Control } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import type { AxiosResponse } from 'axios'

import type { EnumsValue } from '@/entities/document-type'
import { apiService } from '@/shared/api/api'
import type { SelectOption } from '@/shared/types/select-option'
import { resolveSelectValue } from '@/shared/lib/utils/resolve-select-value'
import { AutocompleteInput } from '@/shared/ui/inputs/autocomplete-input'

interface EnumFieldProps {
  name: string
  label: string
  control: Control<Record<string, unknown>>
  readOnly?: boolean
  enumTypeCode: string
}

const toSelectOption = (item: EnumsValue): SelectOption => ({
  id: item.id,
  code: item.code,
  label: item.name,
  raw: item as unknown as Record<string, unknown>,
})

export const EnumField = ({
  name,
  label,
  control,
  readOnly,
  enumTypeCode,
}: EnumFieldProps) => {
  const [opened, setOpened] = useState(false)

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
    enabled: opened,
    staleTime: 5 * 60 * 1000,
    select: (response) => response.data.map(toSelectOption),
  })

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
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
