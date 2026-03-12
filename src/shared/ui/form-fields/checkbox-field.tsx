import { Controller, type Control } from 'react-hook-form'
import { Checkbox, FormControlLabel, FormHelperText } from '@mui/material'

interface CheckboxFieldProps {
  name: string
  label: string
  control: Control<Record<string, unknown>>
  readOnly?: boolean
}

export const CheckboxField = ({
  name,
  label,
  control,
  readOnly,
}: CheckboxFieldProps) => (
  <Controller
    name={name}
    control={control}
    render={({ field, fieldState }) => (
      <div>
        <FormControlLabel
          label={label}
          control={
            <Checkbox
              checked={!!field.value}
              onChange={(e) => {
                field.onChange(e.target.checked)
              }}
              disabled={readOnly}
            />
          }
        />
        {fieldState.error?.message && (
          <FormHelperText error>{fieldState.error.message}</FormHelperText>
        )}
      </div>
    )}
  />
)
