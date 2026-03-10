import { Controller, type Control } from 'react-hook-form'

import { SelectInput } from '@/shared/ui/inputs/select-input'

interface SelectFieldProps {
  name: string
  label: string
  control: Control<Record<string, unknown>>
  readOnly?: boolean
}

export const SelectField = ({
  name,
  label,
  control,
  readOnly,
}: SelectFieldProps) => (
  <Controller
    name={name}
    control={control}
    render={({ field: { ref, ...field }, fieldState }) => (
      <SelectInput
        {...field}
        inputRef={ref}
        value={(field.value as string | undefined) ?? ''}
        label={label}
        readOnly={readOnly}
        error={!!fieldState.error}
        helperText={fieldState.error?.message}
      />
    )}
  />
)
