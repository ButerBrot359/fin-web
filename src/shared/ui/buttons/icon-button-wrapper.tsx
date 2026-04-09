import type { ReactNode } from 'react'

import { cn } from '@/shared/lib/utils/cn'

interface IconButtonWrapperProps {
  children: ReactNode
  ariaLabel: string
  className?: string
  onClick?: () => void
}

export const IconButtonWrapper = ({
  children,
  ariaLabel,
  className,
  onClick,
}: IconButtonWrapperProps) => (
  <button
    type="button"
    aria-label={ariaLabel}
    onClick={onClick}
    className={cn(
      'flex p-2.5 cursor-pointer items-center justify-center rounded-md bg-ui-01 transition-all hover:bg-ui-04 hover:text-accent-02 hover:shadow-md active:bg-ui-03 active:shadow-none',
      className
    )}
  >
    {children}
  </button>
)
