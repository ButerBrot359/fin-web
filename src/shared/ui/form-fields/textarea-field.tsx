import { Controller, type Control } from 'react-hook-form'

import { TextareaInput } from '@/shared/ui/inputs/textarea-input'

interface TextareaFieldProps {
  name: string
  label: string
  control: Control<Record<string, unknown>>
  readOnly?: boolean
}

export const TextareaField = ({
  name,
  label,
  control,
  readOnly,
}: TextareaFieldProps) => (
  <Controller
    name={name}
    control={control}
    render={({ field: { ref, ...field }, fieldState }) => (
      <TextareaInput
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
