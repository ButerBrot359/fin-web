import { CircularProgress, Typography } from '@mui/material'

import ArrowDownIcon from '@/shared/assets/icons/arrow-down.svg'
import { cn } from '@/shared/lib/utils/cn'

interface DropdownButtonProps {
  label: string
  className?: string
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
}

export const DropdownButton = ({
  label,
  className,
  disabled,
  loading,
  onClick,
}: DropdownButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled || loading}
    className={cn(
      'flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md px-3 py-2.5 bg-ui-01 text-ui-06 transition-all hover:bg-ui-04 hover:text-accent-02 hover:shadow-md active:bg-ui-03 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-ui-01 disabled:hover:text-ui-06 disabled:hover:shadow-none',
      className
    )}
  >
    <Typography variant="body2">{label}</Typography>
    {loading ? (
      <CircularProgress size={12} />
    ) : (
      <ArrowDownIcon className="h-2 w-3" />
    )}
  </button>
)
