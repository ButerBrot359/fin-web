import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Typography } from '@mui/material'

import { FavoriteButton } from '@/features/favorite-button'
import { cn } from '@/shared/lib/utils/cn'
import ArrowRightIcon from '@/shared/assets/icons/arrow-right-small-blue.svg'

import type { NavItemProps } from '../types/module-nav'

export const ModuleNavItem = ({ item, pageCode }: NavItemProps) => {
  const { i18n } = useTranslation()
  const navigate = useNavigate()

  const label = i18n.language === 'kz' ? item.nameKz : item.nameRu

  const handleClick = async () => {
    await navigate(
      `/modules/${pageCode}/${item.type.toLowerCase()}/${item.code}`
    )
  }

  return (
    <li
      onClick={handleClick}
      className={cn(
        'group flex cursor-pointer items-center rounded-md hover:bg-ui-01'
      )}
    >
      <FavoriteButton
        iconClassName="h-4 w-4"
        showOnlyOnHover
        onClick={(e) => {
          e.stopPropagation()
        }}
      />
      <Typography variant="body2" className="text-ui-06 flex-1">
        {label}
      </Typography>
      <ArrowRightIcon className="h-5 w-5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
    </li>
  )
}
