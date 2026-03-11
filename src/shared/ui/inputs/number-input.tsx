import { TextField, type TextFieldProps, IconButton } from '@mui/material'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'

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
      onChange={handleChange}
      slotProps={{
        ...slotProps,
        input: {
          ...(slotProps?.input as object),
          readOnly,
          sx: { paddingRight: '4px' },
          endAdornment: (
            <IconButton sx={{ p: '4px', borderRadius: '6px' }} tabIndex={-1}>
              <ArrowDropDownIcon className="text-ui-05" sx={{ fontSize: 20 }} />
            </IconButton>
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
