import { Button as MuiButton } from '@mui/material'
import type { ButtonProps as MuiButtonProps } from '@mui/material'
import { cn } from '@/shared/lib/utils/cn'

export type ButtonProps = MuiButtonProps

export const Button = ({ className, ...props }: ButtonProps) => {
  return (
    <MuiButton
      size="small"
      className={cn(
        'rounded-lg bg-ui-01 text-ui-06 px-4 py-2.5 max-h-10 transition-all hover:bg-ui-04 hover:text-accent-02 hover:shadow-md active:bg-ui-03 active:shadow-none',
        className
      )}
      {...props}
    />
  )
}
