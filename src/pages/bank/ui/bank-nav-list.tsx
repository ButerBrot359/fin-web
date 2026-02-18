import { useState } from 'react'
import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import ArrowRightIcon from '@/shared/assets/icons/arrow-right-small-blue.svg'
import StarBlueIcon from '@/shared/assets/icons/star-blue.svg'
import StarIcon from '@/shared/assets/icons/star.svg'
import { cn } from '@/shared/lib/utils/cn'

import { BANK_COLUMNS, type BankSectionItem } from '../lib/consts/bank-sections'

const NavItem = ({ item }: { item: BankSectionItem }) => {
  const { t } = useTranslation()
  const selectable = Boolean(item.selectable)
  const [isFavorite, setIsFavorite] = useState(false)

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsFavorite((prev) => !prev)
  }

  const Icon = isFavorite ? StarBlueIcon : StarIcon

  return (
    <li
      className={cn(
        'group flex items-center gap-2 rounded-md px-2 py-1 -mx-2',
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
        {t(item.labelKey as never)}
      </Typography>
      {selectable && (
        <ArrowRightIcon className="h-5 w-5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </li>
  )
}

export const BankNavList = () => {
  const { t } = useTranslation()

  return (
    <div className="grid grid-cols-3 gap-x-10">
      {BANK_COLUMNS.map((column, colIdx) => (
        <div key={colIdx} className="flex flex-col gap-6">
          {column.map((section) => (
            <div key={section.titleKey} className="flex flex-col gap-2">
              <Typography
                variant="subtitle1"
                fontWeight={600}
                className="text-accent-02"
              >
                {t(section.titleKey as never)}
              </Typography>
              <ul className="flex flex-col gap-1">
                {section.items.map((item) => (
                  <NavItem key={item.labelKey} item={item} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
