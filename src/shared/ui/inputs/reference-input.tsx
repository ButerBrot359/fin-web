import {
  Autocomplete,
  TextField,
  IconButton,
  type TextFieldProps,
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { useTranslation } from 'react-i18next'

import type { SelectOption } from '@/shared/types/select-option'

interface ReferenceInputProps {
  value: SelectOption | null
  options: SelectOption[]
  onChange: (value: SelectOption | null) => void
  onInputChange?: (event: unknown, value: string, reason: string) => void
  label?: string
  readOnly?: boolean
  error?: boolean
  helperText?: string
  loading?: boolean
  onOpen?: () => void
  onCopy?: () => void
  slotProps?: TextFieldProps['slotProps']
}

export const ReferenceInput = ({
  value,
  options,
  onChange,
  onInputChange,
  label,
  readOnly,
  error,
  helperText,
  loading,
  onOpen,
  onCopy,
  slotProps,
}: ReferenceInputProps) => {
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
                  <IconButton
                    sx={{ p: '4px', borderRadius: '6px' }}
                    tabIndex={-1}
                    onClick={onCopy}
                  >
                    <ContentCopyIcon
                      className="text-ui-05"
                      sx={{ fontSize: 20 }}
                    />
                  </IconButton>
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
