import { Controller, type Control } from 'react-hook-form'

import { TextInput } from '@/shared/ui/inputs/text-input'

interface TextFieldProps {
  name: string
  label: string
  control: Control<Record<string, unknown>>
  readOnly?: boolean
}

export const TextField = ({
  name,
  label,
  control,
  readOnly,
}: TextFieldProps) => (
  <Controller
    name={name}
    control={control}
    render={({ field: { ref, ...field }, fieldState }) => (
      <TextInput
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
