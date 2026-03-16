import { Controller, type Control } from 'react-hook-form'

import { DateTimeInput } from '@/shared/ui/inputs/datetime-input'

interface DateTimeFieldProps {
  name: string
  label: string
  control: Control<Record<string, unknown>>
  readOnly?: boolean
  dateOnly?: boolean
  required?: string
}

export const DateTimeField = ({
  name,
  label,
  control,
  readOnly,
  dateOnly,
  required,
}: DateTimeFieldProps) => (
  <Controller
    name={name}
    control={control}
    rules={{ required }}
    render={({ field, fieldState }) => (
      <DateTimeInput
        value={(field.value as string | undefined) ?? ''}
        onChange={(value) => {
          field.onChange(value)
        }}
        label={label}
        required={!!required}
        readOnly={readOnly}
        dateOnly={dateOnly}
        error={!!fieldState.error}
        helperText={fieldState.error?.message}
      />
    )}
  />
)
