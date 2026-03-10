import { Controller, type Control } from 'react-hook-form'

import { DateTimeInput } from '@/shared/ui/inputs/datetime-input'

interface DateTimeFieldProps {
  name: string
  label: string
  control: Control<Record<string, unknown>>
  readOnly?: boolean
  dateOnly?: boolean
}

export const DateTimeField = ({
  name,
  label,
  control,
  readOnly,
  dateOnly,
}: DateTimeFieldProps) => (
  <Controller
    name={name}
    control={control}
    render={({ field: { ref, ...field }, fieldState }) => (
      <DateTimeInput
        {...field}
        inputRef={ref}
        value={(field.value as string | undefined) ?? ''}
        label={label}
        readOnly={readOnly}
        dateOnly={dateOnly}
        error={!!fieldState.error}
        helperText={fieldState.error?.message}
      />
    )}
  />
)
