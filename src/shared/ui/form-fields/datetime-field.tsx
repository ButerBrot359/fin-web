import { Controller, type Control } from 'react-hook-form'

import { FormFieldWrapper } from './form-field-wrapper'

interface DateTimeFieldProps {
  name: string
  label: string
  control: Control<Record<string, unknown>>
  readOnly?: boolean
  dateOnly?: boolean
}

export const DateTimeField = ({
  name,
  label,
  control,
  readOnly,
  dateOnly,
}: DateTimeFieldProps) => {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        const hasValue = field.value !== undefined && field.value !== ''
        return (
          <FormFieldWrapper label={label} hasValue={hasValue}>
            <input
              {...field}
              type={dateOnly ? 'date' : 'datetime-local'}
              value={(field.value as string | undefined) ?? ''}
              placeholder={hasValue ? undefined : label}
              readOnly={readOnly}
              className="w-full bg-transparent text-[16px] text-ui-06 outline-none placeholder:text-ui-05"
            />
          </FormFieldWrapper>
        )
      }}
    />
  )
}
