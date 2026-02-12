import { Button as MuiButton } from '@mui/material'
import type { ButtonProps as MuiButtonProps } from '@mui/material'
import { cn } from '@/shared/lib/utils/cn'

export type ButtonProps = MuiButtonProps

export const Button = ({ className, ...props }: ButtonProps) => {
  return (
    <MuiButton
      size="small"
      className={cn(
        'rounded-lg bg-ui-01 text-ui-06 px-4 py-2.5 max-h-10',
        className
      )}
      {...props}
    />
  )
}
