import { TextField, type TextFieldProps } from '@mui/material'

import { baseInputSx } from './input-sx'

type DateTimeInputProps = Omit<TextFieldProps, 'variant' | 'type'> & {
  readOnly?: boolean
  dateOnly?: boolean
}

export const DateTimeInput = ({
  readOnly,
  dateOnly,
  slotProps,
  ...rest
}: DateTimeInputProps) => (
  <TextField
    {...rest}
    variant="filled"
    fullWidth
    type={dateOnly ? 'date' : 'datetime-local'}
    sx={baseInputSx}
    slotProps={{
      ...slotProps,
      inputLabel: {
        ...(slotProps?.inputLabel as object),
        shrink: true,
      },
      input: {
        ...(slotProps?.input as object),
        readOnly,
      },
    }}
  />
)
