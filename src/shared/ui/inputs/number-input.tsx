import {
  TextField,
  type TextFieldProps,
  InputAdornment,
  IconButton,
} from '@mui/material'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'

import { baseInputSx } from './input-sx'

type NumberInputProps = Omit<TextFieldProps, 'variant'> & {
  readOnly?: boolean
  decimal?: boolean
}

export const NumberInput = ({
  readOnly,
  decimal,
  onChange,
  slotProps,
  ...rest
}: NumberInputProps) => {
  const handleChange: TextFieldProps['onChange'] = (e) => {
    const val = e.target.value
    if (decimal) {
      if (val === '' || /^-?\d*[.,]?\d*$/.test(val)) {
        onChange?.(e)
      }
    } else {
      if (val === '' || /^-?\d*$/.test(val)) {
        onChange?.(e)
      }
    }
  }

  return (
    <TextField
      {...rest}
      variant="filled"
      fullWidth
      onChange={handleChange}
      sx={baseInputSx}
      slotProps={{
        ...slotProps,
        input: {
          ...(slotProps?.input as object),
          readOnly,
          endAdornment: (
            <InputAdornment position="end">
              <IconButton size="small" tabIndex={-1}>
                <ArrowDropDownIcon className="text-ui-05" fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
        },
        htmlInput: {
          ...(slotProps?.htmlInput as object),
          inputMode: decimal ? 'decimal' : 'numeric',
        },
      }}
    />
  )
}
