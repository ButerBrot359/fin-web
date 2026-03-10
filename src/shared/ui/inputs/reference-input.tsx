import {
  TextField,
  type TextFieldProps,
  InputAdornment,
  IconButton,
} from '@mui/material'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'

import { baseInputSx } from './input-sx'

type ReferenceInputProps = Omit<TextFieldProps, 'variant'> & {
  readOnly?: boolean
}

export const ReferenceInput = ({
  readOnly,
  slotProps,
  ...rest
}: ReferenceInputProps) => (
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
            <IconButton size="small" tabIndex={-1}>
              <ContentCopyIcon className="text-ui-05" sx={{ fontSize: 16 }} />
            </IconButton>
          </InputAdornment>
        ),
      },
    }}
  />
)
