import { Controller, type Control } from 'react-hook-form'

import { TextareaInput } from '@/shared/ui/inputs/textarea-input'

interface TextareaFieldProps {
  name: string
  label: string
  control: Control<Record<string, unknown>>
  readOnly?: boolean
  required?: string
  onValueChange?: () => void
}

export const TextareaField = ({
  name,
  label,
  control,
  readOnly,
  required,
  onValueChange,
}: TextareaFieldProps) => (
  <Controller
    name={name}
    control={control}
    rules={{ required }}
    render={({ field: { ref, onChange, ...field }, fieldState }) => (
      <TextareaInput
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
        error={!!fieldState.error}
        helperText={fieldState.error?.message}
      />
    )}
  />
)
