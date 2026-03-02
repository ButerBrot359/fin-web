import { useState } from 'react'
import { IconButton } from '@mui/material'

import StarIcon from '@/shared/assets/icons/star.svg'
import StarBlueIcon from '@/shared/assets/icons/star-blue.svg'
import { cn } from '@/shared/lib/utils/cn'

interface FavoriteButtonProps {
  className?: string
  iconClassName?: string
  showOnlyOnHover?: boolean
  onClick?: (e: React.MouseEvent) => void
}

export const FavoriteButton = ({
  className,
  iconClassName = 'h-5 w-5',
  showOnlyOnHover = false,
  onClick,
}: FavoriteButtonProps) => {
  const [isFavorite, setIsFavorite] = useState(false)

  const Icon = isFavorite ? StarBlueIcon : StarIcon

  const handleClick = (e: React.MouseEvent) => {
    onClick?.(e)
    setIsFavorite((prev) => !prev)
  }

  return (
    <IconButton
      onClick={handleClick}
      className={cn(
        showOnlyOnHover &&
          !isFavorite &&
          'opacity-0 transition-opacity group-hover:opacity-100',
        className
      )}
    >
      <Icon className={iconClassName} />
    </IconButton>
  )
}
