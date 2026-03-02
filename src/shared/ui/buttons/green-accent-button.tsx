import { cn } from '@/shared/lib/utils/cn'
import type { ButtonProps } from './button'

export const GreenAccentButton = ({ className, ...props }: ButtonProps) => {
  return (
    <button
      className={cn(
        'bg-accent-01 text-ui-06 hover:bg-accent-01/80 py-2.5 px-4 rounded-md cursor-pointer',
        className
      )}
      {...props}
    />
  )
}
