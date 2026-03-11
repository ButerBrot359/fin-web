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
  label?: string
  readOnly?: boolean
  error?: boolean
  helperText?: string
  loading?: boolean
  onCopy?: () => void
  slotProps?: TextFieldProps['slotProps']
}

export const ReferenceInput = ({
  value,
  options,
  onChange,
  label,
  readOnly,
  error,
  helperText,
  loading,
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
                  {params.InputProps.endAdornment}
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
