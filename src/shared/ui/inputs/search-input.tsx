import type { ReactNode } from 'react'
import { TextField, InputAdornment } from '@mui/material'
import { cn } from '@/shared/lib/utils/cn'

interface SearchInputProps {
  placeholder?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  startIcon?: ReactNode
  endContent?: ReactNode
  className?: string
}

export const SearchInput = ({
  placeholder,
  value,
  onChange,
  startIcon,
  endContent,
  className,
}: SearchInputProps) => {
  return (
    <TextField
      variant="standard"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={cn('h-9 rounded-lg', className)}
      slotProps={{
        input: {
          disableUnderline: true,
          className:
            'h-9 gap-[17px] py-2 pr-4 pl-2 text-ui-05 placeholder:text-ui-05',
          startAdornment: startIcon ? (
            <InputAdornment position="start">{startIcon}</InputAdornment>
          ) : undefined,
          endAdornment: endContent ? (
            <InputAdornment position="end">{endContent}</InputAdornment>
          ) : undefined,
        },
      }}
    />
  )
}
