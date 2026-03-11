import { Controller, type Control } from 'react-hook-form'

import type { SelectOption } from '@/shared/types/select-option'
import { ReferenceInput } from '@/shared/ui/inputs/reference-input'

interface ReferenceFieldProps {
  name: string
  label: string
  control: Control<Record<string, unknown>>
  readOnly?: boolean
  options?: SelectOption[]
  loading?: boolean
}

export const ReferenceField = ({
  name,
  label,
  control,
  readOnly,
  options = [],
  loading,
}: ReferenceFieldProps) => (
  <Controller
    name={name}
    control={control}
    render={({ field, fieldState }) => {
      const currentValue =
        options.find((opt) => {
          const raw = field.value as Record<string, unknown> | null | undefined
          if (!raw) return false
          if (typeof raw === 'object' && 'id' in raw) return opt.id === raw.id
          if (typeof raw === 'string') return opt.code === raw
          return false
        }) ?? null

      return (
        <ReferenceInput
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
