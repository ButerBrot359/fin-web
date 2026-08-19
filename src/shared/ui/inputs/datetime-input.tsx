import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker'
import { parseISO, isValid } from 'date-fns'

import { CalendarSidebar, CalendarNavProvider } from './calendar-layout'
import { serializeDateInput } from './serialize-date-input'
import { resolveDateFormatSpec, snapToGranularity } from './date-format-spec'

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
  /**
   * Формат отображения и ввода (date-fns), например «MM.yyyy» у «Месяца
   * начисления». Приходит с бэка в `props.dateFormat` по коду реквизита, то есть
   * задевает 20+ типов документов и колонки ТЧ — поэтому живёт здесь, в общем
   * компоненте даты, а не в конкретной форме. Без ключа поведение прежнее:
   * дд.ММ.гггг и выбор дня.
   */
  dateFormat?: string
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
  dateFormat,
}: DateTimeInputProps) => {
  const dateValue = value ? parseISO(value) : null
  const validDate = dateValue && isValid(dateValue) ? dateValue : null

  const spec = dateFormat ? resolveDateFormatSpec(dateFormat) : null

  const handleChange = (newValue: Date | null) => {
    // Разряды мельче формата пикер берёт из текущего значения или сегодняшнего
    // дня — их нужно обнулить ДО сериализации, иначе выбранный месяц уехал бы
    // на сервер с посторонним днём (см. snapToGranularity).
    const snapped = spec
      ? snapToGranularity(newValue, spec.granularity)
      : newValue
    // DATE-поля (dateOnly) уходят как локальный yyyy-MM-dd, datetime — как ISO Z.
    onChange(serializeDateInput(snapped, dateOnly))
  }

  const slotProps = {
    textField: { error, helperText, required, size, fullWidth },
  }

  const slots = { shortcuts: CalendarSidebar }

  // Без dateFormat пропсы не передаём вовсе — у пикера остаются его дефолты
  // (дд.ММ.гггг, выбор дня), то есть поведение всех прежних полей не меняется.
  const formatProps = spec
    ? { format: dateFormat, views: spec.views, openTo: spec.views.at(-1) }
    : {}

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
          {...formatProps}
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
        // Только формат: `views` у DateTimePicker перечисляют и часы с минутами,
        // и подстановка сюда календарных видов отняла бы у поля ввод времени.
        {...(dateFormat ? { format: dateFormat } : {})}
      />
    </CalendarNavProvider>
  )
}
