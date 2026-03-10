import { TextField, type TextFieldProps } from '@mui/material'

import { baseInputSx } from './input-sx'

type TextInputProps = Omit<TextFieldProps, 'variant'> & {
  readOnly?: boolean
}

export const TextInput = ({ readOnly, slotProps, ...rest }: TextInputProps) => (
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
      },
    }}
  />
)
