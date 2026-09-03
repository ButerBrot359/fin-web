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
      // Тема ставит MuiTextField.fullWidth=true всем полям формы, а строка поиска —
      // не поле формы: её ширину задаёт вызывающий классом (w-64 и т.п.). Без явного
      // false emotion-стиль width:100% (без слоя) побеждает layered-утилиту Tailwind,
      // и поиск растягивается на всю строку — так он и разъехался на экране списка.
      fullWidth={false}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={cn('h-9 rounded-md', className)}
      slotProps={{
        input: {
          disableUnderline: true,
          className:
            'h-9 gap-[17px] py-2.5 pr-4 pl-2 text-ui-05 placeholder:text-ui-05',
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
