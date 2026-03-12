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
