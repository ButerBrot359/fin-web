import {
  TextField,
  type TextFieldProps,
  InputAdornment,
  IconButton,
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'

import { baseInputSx } from './input-sx'

const textareaSx = [
  baseInputSx,
  { '& .MuiFilledInput-root': { height: 'auto', minHeight: 50 } },
]

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
    variant="filled"
    fullWidth
    multiline
    rows={2}
    sx={textareaSx}
    slotProps={{
      ...slotProps,
      input: {
        ...(slotProps?.input as object),
        readOnly,
        endAdornment: (
          <InputAdornment position="end">
            <IconButton size="small" tabIndex={-1}>
              <ContentCopyIcon className="text-ui-05" sx={{ fontSize: 16 }} />
            </IconButton>
          </InputAdornment>
        ),
      },
    }}
  />
)
