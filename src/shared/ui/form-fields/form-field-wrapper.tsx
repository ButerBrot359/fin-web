import type { ReactNode } from 'react'

import { cn } from '@/shared/lib/utils/cn'

interface FormFieldWrapperProps {
  label?: string
  hasValue?: boolean
  actions?: ReactNode
  className?: string
  children: ReactNode
}

export const FormFieldWrapper = ({
  label,
  hasValue,
  actions,
  className,
  children,
}: FormFieldWrapperProps) => {
  return (
    <div
      className={cn(
        'relative flex h-[50px] items-center rounded-md bg-ui-01 px-5 py-1.5',
        className
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        {hasValue && label && (
          <span className="text-[14px] leading-tight text-ui-05">{label}</span>
        )}
        {children}
      </div>
      {actions && (
        <div className="ml-2 flex shrink-0 items-center gap-1">{actions}</div>
      )}
    </div>
  )
}
