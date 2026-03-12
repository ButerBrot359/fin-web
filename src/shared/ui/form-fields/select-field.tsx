import { Controller, type Control } from 'react-hook-form'

import type { SelectOption } from '@/shared/types/select-option'
import { SelectInput } from '@/shared/ui/inputs/select-input'

interface SelectFieldProps {
  name: string
  label: string
  control: Control<Record<string, unknown>>
  readOnly?: boolean
  options?: SelectOption[]
  loading?: boolean
}

export const SelectField = ({
  name,
  label,
  control,
  readOnly,
  options = [],
  loading,
}: SelectFieldProps) => (
  <Controller
    name={name}
    control={control}
    render={({ field, fieldState }) => {
      const raw = field.value as Record<string, unknown> | null | undefined
      const currentValue =
        options.find((opt) => {
          if (!raw) return false
          if (typeof raw === 'object' && 'id' in raw) return opt.id === raw.id
          if (typeof raw === 'string') return opt.code === raw
          return false
        }) ??
        (raw && typeof raw === 'object' && 'id' in raw
          ? {
              id: raw.id as number,
              code: typeof raw.code === 'string' ? raw.code : '',
              label:
                typeof raw.name === 'string'
                  ? raw.name
                  : typeof raw.nameRu === 'string'
                    ? raw.nameRu
                    : '',
              raw,
            }
          : null)

      return (
        <SelectInput
          value={currentValue}
          options={options}
          onChange={(newOption) => {
            field.onChange(newOption?.raw ?? null)
          }}
          label={label}
          readOnly={readOnly}
          loading={loading}
          error={!!fieldState.error}
          helperText={fieldState.error?.message}
        />
      )
    }}
  />
)
