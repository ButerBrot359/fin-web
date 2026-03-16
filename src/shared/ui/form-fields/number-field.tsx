import { Controller, type Control } from 'react-hook-form'

import { NumberInput } from '@/shared/ui/inputs/number-input'

interface NumberFieldProps {
  name: string
  label: string
  control: Control<Record<string, unknown>>
  readOnly?: boolean
  decimal?: boolean
  required?: string
  onValueChange?: () => void
}

export const NumberField = ({
  name,
  label,
  control,
  readOnly,
  decimal,
  required,
  onValueChange,
}: NumberFieldProps) => (
  <Controller
    name={name}
    control={control}
    rules={{ required }}
    render={({ field: { ref, onChange, ...field }, fieldState }) => (
      <NumberInput
        {...field}
        onChange={(e) => {
          onChange(e)
          onValueChange?.()
        }}
        inputRef={ref}
        value={(field.value as string | undefined) ?? ''}
        label={label}
        required={!!required}
        readOnly={readOnly}
        decimal={decimal}
        error={!!fieldState.error}
        helperText={fieldState.error?.message}
      />
    )}
  />
)
