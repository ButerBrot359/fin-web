import type { ComponentPropsWithRef, ReactNode } from 'react'

import { cn } from '@/shared/lib/utils/cn'

type ButtonVariant = 'primary' | 'secondary' | 'tertiary'
type ButtonSize = 'default' | 'small'

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant
  size?: ButtonSize
  startIcon?: ReactNode
  endIcon?: ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-accent-01 text-ui-06 hover:bg-accent-01-hover hover:shadow-primary-hover active:bg-accent-01-pressed active:shadow-none disabled:bg-ui-05 disabled:text-white',
  secondary:
    'bg-ui-01 text-ui-06 hover:bg-ui-04 hover:text-accent-02 hover:shadow-secondary-hover active:bg-ui-08 active:text-accent-02 active:shadow-none disabled:bg-ui-01 disabled:text-ui-05',
  tertiary:
    'text-accent-02 hover:bg-ui-04 hover:shadow-secondary-hover active:bg-ui-08 active:shadow-none disabled:text-ui-05 disabled:bg-transparent',
}

export const Button = ({
  variant = 'secondary',
  size = 'default',
  startIcon,
  endIcon,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) => {
  const isIconOnly = !children

  const paddingClasses = isIconOnly
    ? size === 'small'
      ? 'p-1 rounded-sm'
      : 'p-2.5'
    : cn(
        size === 'small' ? 'py-1.5' : 'py-2.5',
        startIcon
          ? size === 'small'
            ? 'pl-1.5'
            : 'pl-2'
          : size === 'small'
            ? 'pl-3'
            : 'pl-4',
        endIcon
          ? size === 'small'
            ? 'pr-1.5'
            : 'pr-2'
          : size === 'small'
            ? 'pr-3'
            : 'pr-4',
        (startIcon || endIcon) && 'gap-2'
      )

  const sizeClasses = 'text-body2'

  return (
    <button
      type={type}
      className={cn(
        'flex cursor-pointer items-center justify-center rounded-md whitespace-nowrap transition-all disabled:cursor-not-allowed disabled:hover:shadow-none',
        variantClasses[variant],
        sizeClasses,
        paddingClasses,
        className
      )}
      {...rest}
    >
      {isIconOnly ? (
        (startIcon ?? endIcon)
      ) : (
        <>
          {startIcon}
          {children}
          {endIcon}
        </>
      )}
    </button>
  )
}
