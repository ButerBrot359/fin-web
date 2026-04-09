import { cn } from '@/shared/lib/utils/cn'
import type { ButtonProps } from './button'

export const GreenAccentButton = ({ className, ...props }: ButtonProps) => {
  return (
    <button
      className={cn(
        'bg-accent-01 text-ui-06 py-2.5 px-4 rounded-md cursor-pointer text-body2 whitespace-nowrap transition-all hover:shadow-md hover:brightness-95 active:brightness-90 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100 disabled:hover:shadow-none',
        className
      )}
      {...props}
    />
  )
}
