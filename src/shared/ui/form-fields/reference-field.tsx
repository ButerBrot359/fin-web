import { Controller, type Control } from 'react-hook-form'

import { ReferenceInput } from '@/shared/ui/inputs/reference-input'

interface ReferenceFieldProps {
  name: string
  label: string
  control: Control<Record<string, unknown>>
  readOnly?: boolean
}

export const ReferenceField = ({
  name,
  label,
  control,
  readOnly,
}: ReferenceFieldProps) => (
  <Controller
    name={name}
    control={control}
    render={({ field: { ref, ...field }, fieldState }) => (
      <ReferenceInput
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
