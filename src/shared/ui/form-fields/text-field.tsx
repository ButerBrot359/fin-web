import { Controller, type Control } from 'react-hook-form'

import { FormFieldWrapper } from './form-field-wrapper'

interface TextFieldProps {
  name: string
  label: string
  control: Control<Record<string, unknown>>
  readOnly?: boolean
}

export const TextField = ({
  name,
  label,
  control,
  readOnly,
}: TextFieldProps) => {
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
