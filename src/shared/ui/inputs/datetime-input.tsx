import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker'
import { parseISO, isValid } from 'date-fns'

export interface DateTimeInputProps {
  value?: string
  onChange: (value: string) => void
  label?: string
  readOnly?: boolean
  dateOnly?: boolean
  required?: boolean
  error?: boolean
  helperText?: string
  size?: 'small' | 'medium'
}

export const DateTimeInput = ({
  value,
  onChange,
  label,
  readOnly,
  dateOnly,
  required,
  error,
  helperText,
  size,
}: DateTimeInputProps) => {
  const dateValue = value ? parseISO(value) : null
  const validDate = dateValue && isValid(dateValue) ? dateValue : null

  const handleChange = (newValue: Date | null) => {
    if (newValue && isValid(newValue)) {
      onChange(newValue.toISOString())
    } else {
      onChange('')
    }
  }

  const slotProps = {
    textField: { error, helperText, required, size },
  }

  if (dateOnly) {
    return (
      <DatePicker
        value={validDate}
        onChange={handleChange}
        label={label}
        readOnly={readOnly}
        slotProps={slotProps}
      />
    )
  }

  return (
    <DateTimePicker
      value={validDate}
      onChange={handleChange}
      label={label}
      readOnly={readOnly}
      slotProps={slotProps}
    />
  )
}
