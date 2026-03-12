import { Controller, type Control } from 'react-hook-form'

import { NumberInput } from '@/shared/ui/inputs/number-input'

interface NumberFieldProps {
  name: string
  label: string
  control: Control<Record<string, unknown>>
  readOnly?: boolean
  decimal?: boolean
}

export const NumberField = ({
  name,
  label,
  control,
  readOnly,
  decimal,
}: NumberFieldProps) => (
  <Controller
    name={name}
    control={control}
    render={({ field: { ref, ...field }, fieldState }) => (
      <NumberInput
        {...field}
        inputRef={ref}
        value={(field.value as string | undefined) ?? ''}
        label={label}
        readOnly={readOnly}
        decimal={decimal}
        error={!!fieldState.error}
        helperText={fieldState.error?.message}
      />
    )}
  />
)
