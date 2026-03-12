import { Autocomplete, TextField, type TextFieldProps } from '@mui/material'
import { useTranslation } from 'react-i18next'

import type { SelectOption } from '@/shared/types/select-option'

interface SelectInputProps {
  value: SelectOption | null
  options: SelectOption[]
  onChange: (value: SelectOption | null) => void
  label?: string
  readOnly?: boolean
  error?: boolean
  helperText?: string
  onOpen?: () => void
  loading?: boolean
  slotProps?: TextFieldProps['slotProps']
}

export const SelectInput = ({
  value,
  options,
  onChange,
  label,
  readOnly,
  error,
  helperText,
  onOpen,
  loading,
  slotProps,
}: SelectInputProps) => {
  const { t } = useTranslation()

  return (
    <Autocomplete
      value={value}
      options={options}
      onChange={(_e, newValue) => {
        onChange(newValue)
      }}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, val) => option.id === val.id}
      readOnly={readOnly}
      onOpen={onOpen}
      loading={loading}
      loadingText={t('inputs.loading')}
      noOptionsText={t('inputs.noOptions')}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          error={error}
          helperText={helperText}
          slotProps={{
            ...slotProps,
            input: {
              ...params.InputProps,
              ...(slotProps?.input as object),
            },
            htmlInput: {
              ...params.inputProps,
              ...(slotProps?.htmlInput as object),
            },
          }}
        />
      )}
    />
  )
}
