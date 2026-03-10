import { Controller, type Control } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { getDisplayValue } from '@/shared/lib/utils/get-display-value'
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
}: TextFieldProps) => {
  const { i18n } = useTranslation()

  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { ref, ...field }, fieldState }) => (
        <TextInput
          {...field}
          inputRef={ref}
          value={getDisplayValue(field.value, i18n.language)}
          label={label}
          readOnly={readOnly}
          error={!!fieldState.error}
          helperText={fieldState.error?.message}
        />
      )}
    />
  )
}
