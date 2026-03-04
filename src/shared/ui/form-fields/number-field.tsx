import { Controller, type Control } from 'react-hook-form'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import { IconButton } from '@mui/material'

import { FormFieldWrapper } from './form-field-wrapper'

interface NumberFieldProps {
  name: string
  label: string
  control: Control<Record<string, unknown>>
  readOnly?: boolean
  decimal?: boolean
}

export const NumberField = ({
  name,
  label,
  control,
  readOnly,
  decimal,
}: NumberFieldProps) => {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        const hasValue = field.value !== undefined && field.value !== ''
        return (
          <FormFieldWrapper
            label={label}
            hasValue={hasValue}
            actions={
              <IconButton size="small" tabIndex={-1}>
                <ArrowDropDownIcon className="text-ui-05" fontSize="small" />
              </IconButton>
            }
          >
            <input
              {...field}
              value={(field.value as string | undefined) ?? ''}
              onChange={(e) => {
                const val = e.target.value
                if (decimal) {
                  if (val === '' || /^-?\d*[.,]?\d*$/.test(val)) {
                    field.onChange(val)
                  }
                } else {
                  if (val === '' || /^-?\d*$/.test(val)) {
                    field.onChange(val)
                  }
                }
              }}
              placeholder={hasValue ? undefined : label}
              readOnly={readOnly}
              inputMode={decimal ? 'decimal' : 'numeric'}
              className="w-full bg-transparent text-[16px] text-ui-06 outline-none placeholder:text-ui-05"
            />
          </FormFieldWrapper>
        )
      }}
    />
  )
}
