import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker'
import { parseISO, isValid } from 'date-fns'

import { CalendarLayout, CalendarNavProvider } from './calendar-layout'

export interface DateTimeInputProps {
  value?: string
  onChange: (value: string) => void
  label?: string
  readOnly?: boolean
  disabled?: boolean
  dateOnly?: boolean
  required?: boolean
  error?: boolean
  helperText?: string
  size?: 'small' | 'medium'
  onOpen?: () => void
  onClose?: () => void
  /** Растянуть на всю ширину контейнера. */
  fullWidth?: boolean
}

export const DateTimeInput = ({
  value,
  onChange,
  label,
  readOnly,
  disabled,
  dateOnly,
  required,
  error,
  helperText,
  size,
  onOpen,
  onClose,
  fullWidth,
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
    textField: { error, helperText, required, size, fullWidth },
  }

  const slots = { layout: CalendarLayout }

  if (dateOnly) {
    return (
      <CalendarNavProvider
        value={{ referenceValue: validDate, onSelectDate: handleChange }}
      >
        <DatePicker
          value={validDate}
          onChange={handleChange}
          onOpen={onOpen}
          onClose={onClose}
          label={label}
          readOnly={readOnly}
          disabled={disabled}
          slots={slots}
          slotProps={slotProps}
        />
      </CalendarNavProvider>
    )
  }

  return (
    <CalendarNavProvider
      value={{ referenceValue: validDate, onSelectDate: handleChange }}
    >
      <DateTimePicker
        value={validDate}
        onChange={handleChange}
        onOpen={onOpen}
        onClose={onClose}
        label={label}
        readOnly={readOnly}
        disabled={disabled}
        slots={slots}
        slotProps={slotProps}
      />
    </CalendarNavProvider>
  )
}
