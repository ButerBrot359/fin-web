import { TextField, type TextFieldProps } from '@mui/material'

type TextareaInputProps = Omit<TextFieldProps, 'variant'> & {
  readOnly?: boolean
}

export const TextareaInput = ({
  readOnly,
  slotProps,
  ...rest
}: TextareaInputProps) => (
  <TextField
    {...rest}
    multiline
    rows={2}
    sx={{ '& .MuiFilledInput-root': { height: 'auto' } }}
    slotProps={{
      ...slotProps,
      input: {
        ...(slotProps?.input as object),
        readOnly,
      },
    }}
  />
)
