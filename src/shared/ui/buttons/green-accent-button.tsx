import { cn } from '@/shared/lib/utils/cn'
import { Button } from './button'
import type { ButtonProps } from './button'

export const GreenAccentButton = ({ className, ...props }: ButtonProps) => {
  return (
    <Button
      className={cn('bg-accent-01 text-ui-06 hover:bg-accent-01/80', className)}
      {...props}
    />
  )
}
