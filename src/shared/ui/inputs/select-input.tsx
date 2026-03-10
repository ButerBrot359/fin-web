import {
  TextField,
  type TextFieldProps,
  InputAdornment,
  IconButton,
} from '@mui/material'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'

import { baseInputSx } from './input-sx'

type SelectInputProps = Omit<TextFieldProps, 'variant'> & {
  readOnly?: boolean
}

export const SelectInput = ({
  readOnly,
  slotProps,
  ...rest
}: SelectInputProps) => (
  <TextField
    {...rest}
    variant="filled"
    fullWidth
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
    }}
  />
)
