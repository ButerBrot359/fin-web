import { Controller, type Control } from 'react-hook-form'

import { TextareaInput } from '@/shared/ui/inputs/textarea-input'

interface TextareaFieldProps {
  name: string
  label: string
  control: Control<Record<string, unknown>>
  readOnly?: boolean
  required?: string
}

export const TextareaField = ({
  name,
  label,
  control,
  readOnly,
  required,
}: TextareaFieldProps) => (
  <Controller
    name={name}
    control={control}
    rules={{ required }}
    render={({ field: { ref, ...field }, fieldState }) => (
      <TextareaInput
        {...field}
        inputRef={ref}
        value={(field.value as string | undefined) ?? ''}
        label={label}
        required={!!required}
        readOnly={readOnly}
        error={!!fieldState.error}
        helperText={fieldState.error?.message}
      />
    )}
  />
)
