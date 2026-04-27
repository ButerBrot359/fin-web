import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Typography } from '@mui/material'

import { FavoriteButton } from '@/features/favorite-button'

import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'
import ArrowRightIcon from '@/shared/assets/icons/arrow-right-small-blue.svg'

import type { NavItemProps } from '../types/module-nav'

export const ModuleNavItem = ({ item, pageCode }: NavItemProps) => {
  const { i18n } = useTranslation()

  const basePath = `/modules/${pageCode}/${item.type.toLowerCase()}/${item.code}`
  const params = new URLSearchParams()
  if (item.domainKind) params.set('domain', item.domainKind)
  if (item.skipDependsOn) params.set('skipDependsOn', 'true')
  const query = params.toString()
  const url = query ? `${basePath}?${query}` : basePath

  return (
    <li>
      <Link
        to={url}
        className="group flex items-center rounded-md hover:bg-ui-01"
      >
        <FavoriteButton
          iconClassName="h-4 w-4"
          showOnlyOnHover
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
          }}
        />
        <Typography variant="body2" className="flex-1 text-ui-06">
          {getLocalizedName(item, i18n.language)}
        </Typography>
        <ArrowRightIcon className="h-5 w-5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
      </Link>
    </li>
  )
}
