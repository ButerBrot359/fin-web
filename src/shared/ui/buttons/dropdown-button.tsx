import { Typography } from '@mui/material'

import ArrowDownIcon from '@/shared/assets/icons/arrow-down.svg'
import { cn } from '@/shared/lib/utils/cn'

interface DropdownButtonProps {
  label: string
  className?: string
  onClick?: () => void
}

export const DropdownButton = ({
  label,
  className,
  onClick,
}: DropdownButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 bg-ui-01 text-ui-06 hover:bg-ui-01/60',
      className
    )}
  >
    <Typography variant="body2">{label}</Typography>
    <ArrowDownIcon className="h-2 w-3" />
  </button>
)
