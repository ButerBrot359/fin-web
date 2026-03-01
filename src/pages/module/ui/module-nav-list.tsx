import { useNavigate } from 'react-router-dom'
import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import { FavoriteButton } from '@/features/favorite-button'
import ArrowRightIcon from '@/shared/assets/icons/arrow-right-small-blue.svg'
import { cn } from '@/shared/lib/utils/cn'

import type { ModuleElement, ModuleItems } from '../types/module'

interface NavItemProps {
  item: ModuleElement
  pageCode: string
}

const NavItem = ({ item, pageCode }: NavItemProps) => {
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
        'group flex cursor-pointer items-center gap-2 rounded-md px-2 hover:bg-ui-01'
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

interface ModuleNavListProps {
  items: ModuleItems
  pageCode: string
}

export const ModuleNavList = ({ items, pageCode }: ModuleNavListProps) => {
  const { i18n } = useTranslation()

  return (
    <div className="grid grid-cols-3 gap-x-10">
      {items.map((column, colIdx) => (
        <div key={colIdx} className="flex flex-col gap-6">
          {column.map((section) => {
            const title =
              i18n.language === 'kz' ? section.nameKz : section.nameRu

            return (
              <div key={title} className="flex flex-col gap-2">
                <Typography
                  variant="subtitle1"
                  fontWeight={600}
                  className="text-accent-02"
                >
                  {title}
                </Typography>
                <ul className="flex flex-col gap-1">
                  {section.elements.map((element) => (
                    <NavItem
                      key={element.code}
                      item={element}
                      pageCode={pageCode}
                    />
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
