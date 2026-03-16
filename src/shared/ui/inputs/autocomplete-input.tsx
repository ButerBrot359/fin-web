import type { ReactNode } from 'react'
import { Autocomplete, TextField, type TextFieldProps } from '@mui/material'
import { useTranslation } from 'react-i18next'

import type { SelectOption } from '@/shared/types/select-option'

interface AutocompleteInputProps {
  value: SelectOption | null
  options: SelectOption[]
  onChange: (value: SelectOption | null) => void
  onInputChange?: (event: unknown, value: string, reason: string) => void
  label?: string
  readOnly?: boolean
  required?: boolean
  error?: boolean
  helperText?: string
  loading?: boolean
  onOpen?: () => void
  endAction?: ReactNode
  slotProps?: TextFieldProps['slotProps']
}

export const AutocompleteInput = ({
  value,
  options,
  onChange,
  onInputChange,
  label,
  readOnly,
  required,
  error,
  helperText,
  loading,
  onOpen,
  endAction,
  slotProps,
}: AutocompleteInputProps) => {
  const { t } = useTranslation()

  return (
    <Autocomplete
      value={value}
      options={options}
      onChange={(_e, newValue) => {
        onChange(newValue)
      }}
      onInputChange={onInputChange}
      onOpen={onOpen}
      filterOptions={onInputChange ? (x) => x : undefined}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, val) => option.id === val.id}
      readOnly={readOnly}
      loading={loading}
      loadingText={t('inputs.loading')}
      noOptionsText={t('inputs.noOptions')}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required={required}
          error={error}
          helperText={helperText}
          slotProps={{
            ...slotProps,
            input: {
              ...params.InputProps,
              ...(slotProps?.input as object),
              endAdornment: (
                <>
                  {params.InputProps.endAdornment}
                  {endAction}
                </>
              ),
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
