import { Controller, type Control } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { getDisplayValue } from '@/shared/lib/utils/get-display-value'
import { TextInput } from '@/shared/ui/inputs/text-input'

interface TextFieldProps {
  name: string
  label: string
  control: Control<Record<string, unknown>>
  readOnly?: boolean
  required?: string
  onValueChange?: () => void
}

export const TextField = ({
  name,
  label,
  control,
  readOnly,
  required,
  onValueChange,
}: TextFieldProps) => {
  const { i18n } = useTranslation()

  return (
    <Controller
      name={name}
      control={control}
      rules={{ required }}
      render={({ field: { ref, onChange, ...field }, fieldState }) => (
        <TextInput
          {...field}
          onChange={(e) => {
            onChange(e)
            onValueChange?.()
          }}
          inputRef={ref}
          value={getDisplayValue(field.value, i18n.language)}
          label={label}
          required={!!required}
          readOnly={readOnly}
          error={!!fieldState.error}
          helperText={fieldState.error?.message}
        />
      )}
    />
  )
}
