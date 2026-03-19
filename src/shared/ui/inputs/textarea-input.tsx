import { TextField, Tooltip, type TextFieldProps } from '@mui/material'

type TextareaInputProps = Omit<TextFieldProps, 'variant'> & {
  readOnly?: boolean
}

export const TextareaInput = ({
  readOnly,
  slotProps,
  value,
  ...rest
}: TextareaInputProps) => (
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
  </Tooltip>
)
