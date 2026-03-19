import { TextField, Tooltip, type TextFieldProps } from '@mui/material'

type TextInputProps = Omit<TextFieldProps, 'variant'> & {
  readOnly?: boolean
}

export const TextInput = ({
  readOnly,
  slotProps,
  value,
  ...rest
}: TextInputProps) => (
  <Tooltip
    title={typeof value === 'string' ? value : ''}
    enterDelay={700}
    placement="bottom-start"
    disableInteractive
    slotProps={{
      popper: { modifiers: [{ name: 'offset', options: { offset: [0, -8] } }] },
      tooltip: { sx: { maxWidth: 500 } },
    }}
  >
    <TextField
      value={value}
      {...rest}
      slotProps={{
        ...slotProps,
        input: {
          ...(slotProps?.input as object),
          readOnly,
        },
      }}
    />
  </Tooltip>
)
