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
    sx={{
      '& .MuiFilledInput-root': {
        height: 'auto',
        paddingLeft: '20px',
        paddingRight: '20px',
      },
      '& .MuiFilledInput-root textarea': {
        paddingLeft: 0,
        paddingRight: 0,
      },
    }}
    slotProps={{
      ...slotProps,
      input: {
        ...(slotProps?.input as object),
        readOnly,
      },
    }}
  />
)
