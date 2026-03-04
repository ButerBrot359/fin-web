import { Controller, type Control } from 'react-hook-form'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { IconButton } from '@mui/material'

import { cn } from '@/shared/lib/utils/cn'

import { FormFieldWrapper } from './form-field-wrapper'

interface TextareaFieldProps {
  name: string
  label: string
  control: Control<Record<string, unknown>>
  readOnly?: boolean
}

export const TextareaField = ({
  name,
  label,
  control,
  readOnly,
}: TextareaFieldProps) => {
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
            className={cn('h-auto min-h-[50px]')}
            actions={
              <IconButton size="small" tabIndex={-1}>
                <ContentCopyIcon className="text-ui-05" sx={{ fontSize: 16 }} />
              </IconButton>
            }
          >
            <textarea
              {...field}
              value={(field.value as string | undefined) ?? ''}
              placeholder={hasValue ? undefined : label}
              readOnly={readOnly}
              rows={2}
              className="w-full resize-none bg-transparent text-[16px] text-ui-06 outline-none placeholder:text-ui-05"
            />
          </FormFieldWrapper>
        )
      }}
    />
  )
}
