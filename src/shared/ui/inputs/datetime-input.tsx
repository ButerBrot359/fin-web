import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker'
import { parseISO, isValid } from 'date-fns'

interface DateTimeInputProps {
  value?: string
  onChange: (value: string) => void
  label?: string
  readOnly?: boolean
  dateOnly?: boolean
  error?: boolean
  helperText?: string
}

export const DateTimeInput = ({
  value,
  onChange,
  label,
  readOnly,
  dateOnly,
  error,
  helperText,
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
    textField: { error, helperText },
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
