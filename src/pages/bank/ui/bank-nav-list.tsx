import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import ArrowRightIcon from '@/shared/assets/icons/arrow-right-small-blue.svg'
import StarBlueIcon from '@/shared/assets/icons/star-blue.svg'
import StarIcon from '@/shared/assets/icons/star.svg'
import { cn } from '@/shared/lib/utils/cn'

import type { ModuleElement, ModuleItems } from '../types/bank-module'

const ELEMENT_ROUTES: Record<string, string> = {
  PrikhodnyyKassovyyOrder: '/bank/cash-receipt-order',
}

const NavItem = ({ item }: { item: ModuleElement }) => {
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  const path = ELEMENT_ROUTES[item.code]
  const selectable = Boolean(path)
  const [isFavorite, setIsFavorite] = useState(false)

  const label = i18n.language === 'kz' ? item.nameKz : item.nameRu

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsFavorite((prev) => !prev)
  }

  const handleClick = async () => {
    if (path) {
      await navigate(path)
    }
  }

  const Icon = isFavorite ? StarBlueIcon : StarIcon

  return (
    <li
      onClick={handleClick}
      className={cn(
        'group flex items-center gap-2 rounded-md px-2 py-1',
        selectable && 'cursor-pointer hover:bg-ui-01',
        !selectable && 'cursor-not-allowed'
      )}
    >
      <button
        type="button"
        onClick={handleFavorite}
        className={cn(
          'shrink-0 cursor-pointer transition-opacity',
          !isFavorite && 'opacity-0 group-hover:opacity-100'
        )}
      >
        <Icon className="h-4 w-4" />
      </button>
      <Typography variant="body2" className="text-ui-06 flex-1">
        {label}
      </Typography>
      {selectable && (
        <ArrowRightIcon className="h-5 w-5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </li>
  )
}

interface BankNavListProps {
  items: ModuleItems
}

export const BankNavList = ({ items }: BankNavListProps) => {
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
                    <NavItem key={element.code} item={element} />
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
