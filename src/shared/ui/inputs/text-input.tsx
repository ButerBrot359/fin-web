import { TextField, type TextFieldProps } from '@mui/material'

type TextInputProps = Omit<TextFieldProps, 'variant'> & {
  readOnly?: boolean
}

export const TextInput = ({ readOnly, slotProps, ...rest }: TextInputProps) => (
  <TextField
    {...rest}
    slotProps={{
      ...slotProps,
      input: {
        ...(slotProps?.input as object),
        readOnly,
      },
    }}
  />
)
